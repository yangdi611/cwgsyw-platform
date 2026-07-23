package com.cwgsyw.platform.module.task;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Testcontainers
class UnifiedTaskFreshInstallMigrationTest {

    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
        .withDatabaseName("unified_task_fresh_install")
        .withUsername("migration")
        .withPassword("migration");

    private static JdbcTemplate jdbcTemplate;

    @BeforeAll
    static void migrateEmptyDatabaseToLatest() {
        var dataSource = new DriverManagerDataSource(
            POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        jdbcTemplate = new JdbcTemplate(dataSource);
        Flyway flyway = Flyway.configure()
            .dataSource(dataSource)
            .locations("classpath:db/migration")
            .validateOnMigrate(true)
            .load();

        assertEquals(107, flyway.migrate().migrationsExecuted);
        assertEquals(109, jdbcTemplate.queryForObject(
            "SELECT MAX(CAST(version AS INTEGER)) FROM flyway_schema_history", Integer.class));
    }

    @Test
    void freshInstallHasTheSameUnifiedTaskTerminalSchemaAndSeeds() {
        List<String> taskTables = List.of(
            "task_template", "task_template_version", "task_template_field", "task_plan",
            "task_plan_generation", "task_instance", "task_draft", "task_submission",
            "approval_scheme", "approval_scheme_version", "approval_round", "approval_action",
            "task_field_fact", "task_metric_definition", "task_metric_binding", "task_metric_fact",
            "task_analytics_dashboard", "task_analytics_widget", "task_metric_goal", "task_relation",
            "task_automation_rule", "task_automation_execution", "task_analytics_subscription",
            "task_notification_delivery"
        );
        taskTables.forEach(table -> assertTrue(tableExists(table), table + " must exist after a V1 fresh install"));

        assertEquals(3, count("SELECT COUNT(*) FROM task_template WHERE tenant_id = 'default' AND builtin AND status = 'published'"));
        assertEquals(1, count("SELECT COUNT(*) FROM task_template WHERE tenant_id = 'default' AND code = 'daily_work_report'"));
        assertEquals(1, count("""
            SELECT COUNT(*) FROM task_plan plan
            JOIN task_template_version version ON version.id = plan.template_version_id
            JOIN task_template template ON template.id = version.template_id
            WHERE plan.tenant_id = 'default' AND plan.status = 'active'
              AND plan.generation_mode = 'per_user' AND template.code = 'daily_work_report'
            """));
        assertEquals(7, count("""
            SELECT COUNT(*) FROM sys_resource
            WHERE code IN ('task_template','task_plan','task','task_analytics','approval','work_item','calendar_settings')
            """));
        assertEquals(1, count("SELECT COUNT(*) FROM sys_permission WHERE code = 'workflow:approve'"));

        List<String> removedTables = List.of(
            "daily_report", "daily_report_approval", "ops_schedule_rule", "ops_schedule_task",
            "ops_schedule_task_participant", "ops_schedule_checklist_item", "ops_schedule_task_log",
            "ops_schedule_task_link", "ops_schedule_notification_log", "ops_schedule_template"
        );
        removedTables.forEach(table -> assertFalse(tableExists(table), table + " must not survive the terminal schema"));
        assertEquals(0, count("SELECT COUNT(*) FROM sys_permission WHERE code LIKE 'daily_report:%' OR code LIKE 'ops_calendar:%'"));
        assertEquals(0, count("SELECT COUNT(*) FROM sys_resource WHERE code IN ('daily_report', 'ops_calendar')"));

        assertNoColumns("ops_duty_roster", "created_at", "created_by", "deleted_at", "deleted_by");
        assertNoColumns("ops_holiday_calendar", "created_at", "created_by", "deleted_at", "deleted_by");
        assertNoColumns("task_metric_goal", "is_deleted", "deleted_at", "deleted_by", "created_by", "updated_by", "created_at", "updated_at");
        assertNoColumns("task_metric_definition", "created_by", "updated_by", "is_deleted", "deleted_at", "deleted_by");
        assertNoColumns("task_metric_binding", "created_by", "created_at");
        assertNoColumns("task_relation", "created_by");
        assertNoColumns("task_automation_rule", "lock_version", "created_by", "is_deleted", "deleted_at", "deleted_by");
        assertNoColumns("task_analytics_subscription", "created_by", "updated_by", "is_deleted", "deleted_at", "deleted_by");
        assertNoColumns("task_analytics_widget", "created_at");
        List<String> preservedNonTaskTables = List.of(
            "ai_call_log", "sys_user_role", "wiki_space_acl", "wiki_page_acl", "shared_folder_acl",
            "authorization_migration_run", "authorization_migration_exception", "authorization_migration_lineage",
            "authorization_account_rollout", "authorization_decision_diff", "authorization_tenant_cutover"
        );
        preservedNonTaskTables.forEach(table -> assertTrue(tableExists(table),
            table + " belongs to a non-task module and must survive terminal migration"));
        assertColumns("notification_message", "is_deleted", "deleted_at", "deleted_by", "updated_at", "created_by", "updated_by");
        assertColumns("backup_record", "backup_type", "is_deleted", "deleted_at", "deleted_by", "updated_at", "updated_by");
        assertColumns("sys_config", "description");
        assertColumns("cmdb_alert", "raw_labels");
        assertEquals(1, count("""
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'task_metric_binding'
              AND column_name = 'ratio_component'
            """));
        assertEquals(1, count("""
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'task_metric_fact'
              AND column_name = 'denominator_field_fact_id'
            """));
        assertEquals(1, count("SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_task_metric_binding_ratio_component'"));

        assertEquals(1, count("SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_task_automation_rule_active'"));
        assertEquals(1, count("SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_task_analytics_subscription_due'"));
        assertEquals(1, count("SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_notification_user_unread'"));
        assertEquals(1, count("SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_task_notification_delivery_dedupe'"));
        assertEquals(1, count("SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_task_metric_definition_code' " +
            "AND indexdef NOT LIKE '%WHERE%'"));
    }

    private static void assertNoColumns(String table, String... columns) {
        assertEquals(0, count("""
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = ? AND column_name = ANY (?::text[])
            """, table, "{" + String.join(",", columns) + "}"));
    }

    private static void assertColumns(String table, String... columns) {
        assertEquals(columns.length, count("""
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = ? AND column_name = ANY (?::text[])
            """, table, "{" + String.join(",", columns) + "}"));
    }

    private static boolean tableExists(String tableName) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject(
            "SELECT to_regclass('public.' || ?) IS NOT NULL", Boolean.class, tableName));
    }

    private static int count(String sql, Object... args) {
        return jdbcTemplate.queryForObject(sql, Integer.class, args);
    }
}
