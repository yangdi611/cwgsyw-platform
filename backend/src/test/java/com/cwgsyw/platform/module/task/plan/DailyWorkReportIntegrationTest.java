package com.cwgsyw.platform.module.task.plan;

import com.cwgsyw.platform.config.MyBatisPlusConfig;
import com.cwgsyw.platform.module.task.notification.TaskNotificationOutbox;
import com.cwgsyw.platform.module.task.plan.entity.TaskPlan;
import com.cwgsyw.platform.module.task.plan.mapper.TaskPlanMapper;
import com.cwgsyw.platform.module.task.plan.scheduler.JdbcHolidayCalendarAdapter;
import com.cwgsyw.platform.module.task.plan.scheduler.TaskOccurrenceCalculator;
import com.cwgsyw.platform.module.task.plan.service.CiScopeResolver;
import com.cwgsyw.platform.module.task.plan.service.JdbcAssignmentDirectory;
import com.cwgsyw.platform.module.task.plan.service.TaskAssignmentResolver;
import com.cwgsyw.platform.module.task.plan.service.TaskGenerationExecutor;
import com.cwgsyw.platform.module.task.plan.service.TaskPlanGenerator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
    classes = DailyWorkReportIntegrationTest.TestApplication.class,
    properties = {
        "spring.main.web-application-type=none",
        "spring.flyway.enabled=true",
        "spring.flyway.validate-on-migrate=false",
        "flowable.database-schema-update=create-drop",
        "flowable.async-executor-activate=false"
    }
)
@Testcontainers
class DailyWorkReportIntegrationTest {
    private static final LocalDate MONDAY = LocalDate.of(2026, 7, 20);

    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
        .withDatabaseName("daily_work_report")
        .withUsername("daily")
        .withPassword("daily");

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> POSTGRES.getJdbcUrl() + "&stringtype=unspecified");
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private TaskPlanGenerator generator;

    @Autowired
    private TaskPlanMapper planMapper;

    @BeforeEach
    void resetGeneratedData() {
        jdbc.update("DELETE FROM task_notification_delivery");
        jdbc.update("DELETE FROM task_participant");
        jdbc.update("DELETE FROM task_instance");
        jdbc.update("DELETE FROM task_plan_generation");
        jdbc.update("DELETE FROM ops_holiday_calendar WHERE name LIKE '测试%'");
        jdbc.update("DELETE FROM sys_user WHERE username LIKE 'daily-%'");
        jdbc.update("""
            UPDATE task_plan
            SET approval_scheme_version_id = NULL, generate_ahead_days = 0,
                start_date = CURRENT_DATE, end_date = NULL,
                status = 'active', last_generated_at = NULL, next_generate_at = NOW(), lock_version = 0
            WHERE tenant_id = 'default' AND name = '内置工作日报计划'
            """);
    }

    @Test
    void generatesOneWorkdayReportPerActiveUserAndRetryIsIdempotent() {
        long databaseGroupId = jdbc.queryForObject(
            "SELECT id FROM sys_group WHERE tenant_id = 'default' AND name = '数据库组' AND NOT is_deleted",
            Long.class);
        long secondUserId = insertUser("daily-worker", "日报执行人", databaseGroupId, 1, false);
        insertUser("daily-disabled", "已停用执行人", databaseGroupId, 0, false);
        insertUser("daily-deleted", "已删除执行人", databaseGroupId, 1, true);
        long activeUsers = count(
            "SELECT COUNT(*) FROM sys_user WHERE tenant_id = 'default' AND status = 1 AND NOT is_deleted");

        long planId = dailyPlanId();
        preparePlan(planId, MONDAY, null);

        int generated = generate(planId, MONDAY);

        assertThat(generated).isEqualTo(activeUsers);
        assertThat(count("""
            SELECT COUNT(*) FROM task_instance
            WHERE plan_id = ? AND business_date = ? AND title = '工作日报'
            """, planId, MONDAY)).isEqualTo(activeUsers);
        assertThat(count("""
            SELECT COUNT(DISTINCT assignee_id) FROM task_instance
            WHERE plan_id = ? AND business_date = ?
            """, planId, MONDAY)).isEqualTo(activeUsers);
        assertThat(count("""
            SELECT COUNT(*) FROM task_instance
            WHERE plan_id = ? AND business_date = ? AND assignee_id = ? AND group_id = ?
            """, planId, MONDAY, secondUserId, databaseGroupId)).isEqualTo(1);
        assertThat(count("""
            SELECT COUNT(*) FROM task_instance task
            JOIN sys_user user_account ON user_account.id = task.assignee_id
            WHERE task.plan_id = ? AND task.business_date = ?
              AND user_account.username IN ('daily-disabled', 'daily-deleted')
            """, planId, MONDAY)).isZero();
        assertThat(count("""
            SELECT COUNT(*) FROM task_notification_delivery delivery
            JOIN task_instance task ON task.id = delivery.task_id
            WHERE task.plan_id = ? AND task.business_date = ? AND delivery.event_type = 'task_created'
            """, planId, MONDAY)).isEqualTo(activeUsers);

        TaskPlan stalePlan = planMapper.selectById(planId);
        stalePlan.setLastGeneratedAt(null);
        assertThat(generator.generatePlan(stalePlan, MONDAY.atTime(9, 2))).isZero();
        assertThat(count("SELECT COUNT(*) FROM task_plan_generation WHERE plan_id = ?", planId))
            .isEqualTo(activeUsers);
        assertThat(count("SELECT COUNT(*) FROM task_instance WHERE plan_id = ? AND business_date = ?", planId, MONDAY))
            .isEqualTo(activeUsers);
    }

    @Test
    void skipsWeekendsAndCarriesConfiguredApprovalVersionIntoGeneratedTasks() {
        long planId = dailyPlanId();
        long schemeVersionId = insertPublishedGroupApprovalScheme();
        LocalDate saturday = LocalDate.of(2026, 7, 25);
        preparePlan(planId, saturday, schemeVersionId);

        assertThat(generate(planId, saturday)).isZero();

        LocalDate monday = saturday.plusDays(2);
        preparePlan(planId, monday, schemeVersionId);
        int generated = generate(planId, monday);

        assertThat(generated).isGreaterThan(0);
        assertThat(count("""
            SELECT COUNT(*) FROM task_instance
            WHERE plan_id = ? AND business_date = ?
              AND approval_scheme_version_id = ? AND approval_status = 'not_started'
            """, planId, monday, schemeVersionId)).isEqualTo(generated);
    }

    @Test
    void skipsHolidayAndGeneratesOnWeekendWorkdayOverride() {
        long planId = dailyPlanId();
        LocalDate mondayHoliday = LocalDate.of(2026, 7, 27);
        insertHoliday("测试法定假日", mondayHoliday, mondayHoliday, "[]");
        preparePlan(planId, mondayHoliday, null);

        assertThat(generate(planId, mondayHoliday)).isZero();

        LocalDate weekendOverride = LocalDate.of(2026, 7, 26);
        insertHoliday("测试调休", LocalDate.of(2026, 7, 28), LocalDate.of(2026, 7, 28),
            "[\"2026-07-26\"]");
        preparePlan(planId, weekendOverride, null);

        int generated = generate(planId, weekendOverride);
        long activeUsers = count(
            "SELECT COUNT(*) FROM sys_user WHERE tenant_id = 'default' AND status = 1 AND NOT is_deleted");
        assertThat(generated).isEqualTo(activeUsers);
    }

    @Test
    void builtInReportTemplateContainsFormCiAttachmentAndAnalyticsContracts() {
        assertThat(jdbc.queryForList("""
            SELECT field.field_key
            FROM task_template template
            JOIN task_template_version version ON version.id = template.latest_version_id
            JOIN task_template_field field ON field.template_version_id = version.id
            WHERE template.tenant_id = 'default' AND template.code = 'daily_work_report'
            ORDER BY field.sort_order
            """, String.class)).containsExactly(
                "completed_items", "issues", "tomorrow_plan", "work_hours", "related_ci", "attachments");
        assertThat(count("""
            SELECT COUNT(*)
            FROM task_template template
            JOIN task_template_version version ON version.id = template.latest_version_id
            JOIN task_template_field field ON field.template_version_id = version.id
            WHERE template.code = 'daily_work_report'
              AND field.field_key = 'work_hours'
              AND field.analytics_config @> '{"enabled":true,"role":["metric"],"aggregation":"sum"}'::jsonb
            """)).isEqualTo(1);
        assertThat(count("""
            SELECT COUNT(*)
            FROM task_template template
            JOIN task_template_version version ON version.id = template.latest_version_id
            JOIN task_template_field field ON field.template_version_id = version.id
            WHERE template.code = 'daily_work_report'
              AND field.field_key = 'related_ci' AND field.field_type = 'ci_scope'
              AND field.validation_config @> '{"allowModelGroups":true,"allowModels":true,"allowInstances":true}'::jsonb
            """)).isEqualTo(1);
        assertThat(count("""
            SELECT COUNT(*)
            FROM task_template template
            JOIN task_template_version version ON version.id = template.latest_version_id
            JOIN task_template_field field ON field.template_version_id = version.id
            WHERE template.code = 'daily_work_report'
              AND field.field_key = 'attachments' AND field.field_type = 'file'
            """)).isEqualTo(1);
    }

    private int generate(long planId, LocalDate date) {
        TaskPlan plan = planMapper.selectById(planId);
        return generator.generatePlan(plan, date.atTime(9, 1));
    }

    private void preparePlan(long planId, LocalDate date, Long approvalSchemeVersionId) {
        jdbc.update("""
            UPDATE task_plan
            SET approval_scheme_version_id = ?, start_date = ?, end_date = ?, generate_ahead_days = 0,
                status = 'active', last_generated_at = NULL, next_generate_at = ?, lock_version = 0
            WHERE id = ?
            """, approvalSchemeVersionId, date, date, date.atStartOfDay(), planId);
    }

    private long insertUser(String username, String realName, long groupId, int status, boolean deleted) {
        return jdbc.queryForObject("""
            INSERT INTO sys_user (tenant_id, group_id, username, password, real_name, status, is_deleted)
            VALUES ('default', ?, ?, 'not-used', ?, ?, ?)
            RETURNING id
            """, Long.class, groupId, username, realName, status, deleted);
    }

    private void insertHoliday(String name, LocalDate start, LocalDate end, String overrides) {
        jdbc.update("""
            INSERT INTO ops_holiday_calendar
              (tenant_id, name, start_date, end_date, holiday_type, workday_overrides, enabled)
            VALUES ('default', ?, ?, ?, 'legal', ?, TRUE)
            """, name, start, end, overrides);
    }

    private long insertPublishedGroupApprovalScheme() {
        long groupId = jdbc.queryForObject(
            "SELECT id FROM sys_group WHERE tenant_id = 'default' AND name = '数据库组' AND NOT is_deleted",
            Long.class);
        long schemeId = jdbc.queryForObject("""
            INSERT INTO approval_scheme
              (tenant_id, code, name, status, scope_type, owner_group_id, is_deleted)
            VALUES ('default', 'daily_database_review', '数据库组日报审批', 'published', 'group', ?, FALSE)
            RETURNING id
            """, Long.class, groupId);
        long versionId = jdbc.queryForObject("""
            INSERT INTO approval_scheme_version
              (tenant_id, scheme_id, version, status, definition_config, published_at)
            VALUES ('default', ?, 1, 'published', ?::jsonb, NOW())
            RETURNING id
            """, Long.class, schemeId,
            "{\"nodes\":[{\"key\":\"group_review\",\"candidateGroup\":\"group_" + groupId + "\"}]}");
        jdbc.update("UPDATE approval_scheme SET latest_version_id = ? WHERE id = ?", versionId, schemeId);
        return versionId;
    }

    private long dailyPlanId() {
        return jdbc.queryForObject("""
            SELECT id FROM task_plan
            WHERE tenant_id = 'default' AND name = '内置工作日报计划' AND NOT is_deleted
            """, Long.class);
    }

    private long count(String sql, Object... args) {
        Long value = jdbc.queryForObject(sql, Long.class, args);
        return value == null ? 0 : value;
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    @MapperScan(basePackages = {
        "com.cwgsyw.platform.module.task.plan.mapper",
        "com.cwgsyw.platform.module.task.notification",
        "com.cwgsyw.platform.module.task.runtime.mapper",
        "com.cwgsyw.platform.module.task.template.mapper",
        "com.cwgsyw.platform.module.cmdb.mapper"
    }, annotationClass = org.apache.ibatis.annotations.Mapper.class)
    @Import({
        MyBatisPlusConfig.class,
        TaskPlanGenerator.class,
        TaskOccurrenceCalculator.class,
        JdbcHolidayCalendarAdapter.class,
        TaskAssignmentResolver.class,
        JdbcAssignmentDirectory.class,
        CiScopeResolver.class,
        TaskGenerationExecutor.class,
        TaskNotificationOutbox.class
    })
    static class TestApplication {}
}
