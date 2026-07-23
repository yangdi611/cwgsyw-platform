package com.cwgsyw.platform.module.task;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.flowable.engine.ProcessEngine;
import org.flowable.engine.ProcessEngineConfiguration;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.AfterAll;
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
class UnifiedTaskIncrementalMigrationTest {

    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
        .withDatabaseName("unified_task_incremental")
        .withUsername("migration")
        .withPassword("migration");

    private static JdbcTemplate jdbcTemplate;
    private static ProcessEngine flowable;
    private static String deviceDefinitionId;
    private static int deviceDefinitionVersion;
    private static long legacyAuthorizationUserId;
    private static long legacyAuthorizationRoleId;
    private static long legacyAuthorizationGroupId;
    private static long legacyAuthorizationWikiSpaceId;
    private static long legacyAuthorizationWikiPageId;
    private static long legacyAuthorizationSharedFolderId;

    @BeforeAll
    static void migrateExistingDatabase() {
        var dataSource = new DriverManagerDataSource(
            POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        jdbcTemplate = new JdbcTemplate(dataSource);

        Flyway existingPlatform = Flyway.configure()
            .dataSource(dataSource)
            .locations("classpath:db/migration")
            .target(MigrationVersion.fromVersion("79"))
            .validateOnMigrate(true)
            .load();
        assertTrue(existingPlatform.migrate().migrationsExecuted > 0);

        jdbcTemplate.update("""
            INSERT INTO sys_config (tenant_id, config_key, config_value)
            VALUES ('migration-test', 'preserve.non_target_data', 'keep-me')
            """);
        jdbcTemplate.update("""
            INSERT INTO notification_message
                (tenant_id, user_id, title, content, type, is_deleted)
            VALUES ('migration-test', 1, 'obsolete notification', 'must be removed', 'system', TRUE)
            """);
        jdbcTemplate.update("""
            INSERT INTO workflow_process_binding
                (tenant_id, business_type, process_definition_id, process_definition_key,
                 process_definition_version, enabled)
            VALUES ('migration-test', 'change_doc', 'keep-definition', 'changeDocApproval', 1, TRUE)
            """);
        seedLegacyAuthorizationData();
        flowable = ProcessEngineConfiguration.createStandaloneProcessEngineConfiguration()
            .setJdbcUrl(POSTGRES.getJdbcUrl())
            .setJdbcUsername(POSTGRES.getUsername())
            .setJdbcPassword(POSTGRES.getPassword())
            .setJdbcDriver("org.postgresql.Driver")
            .setDatabaseSchemaUpdate(ProcessEngineConfiguration.DB_SCHEMA_UPDATE_TRUE)
            .setAsyncExecutorActivate(false)
            .buildProcessEngine();
        var dailyDeployment = flowable.getRepositoryService().createDeployment()
            .name("legacy daily approval")
            .addString("daily-report.bpmn20.xml", processXml("dailyReportApproval"))
            .deploy();
        var deviceDeployment = flowable.getRepositoryService().createDeployment()
            .name("preserved device approval")
            .addString("device-access.bpmn20.xml", processXml("deviceAccessApproval"))
            .deploy();
        assertEquals(1, flowable.getRepositoryService().createProcessDefinitionQuery()
            .deploymentId(dailyDeployment.getId()).count());
        var dailyDefinition = flowable.getRepositoryService().createProcessDefinitionQuery()
            .deploymentId(dailyDeployment.getId()).singleResult();
        var deviceDefinition = flowable.getRepositoryService().createProcessDefinitionQuery()
            .deploymentId(deviceDeployment.getId()).singleResult();
        deviceDefinitionId = deviceDefinition.getId();
        deviceDefinitionVersion = deviceDefinition.getVersion();
        flowable.getRuntimeService().startProcessInstanceByKey("dailyReportApproval", "dailyReport:legacy-1");
        flowable.getRuntimeService().startProcessInstanceById(dailyDefinition.getId(), "legacy-daily-nonstandard-key");
        flowable.getRuntimeService().startProcessInstanceByKey("deviceAccessApproval", "deviceAccess:keep-1");
        jdbcTemplate.update("""
            INSERT INTO sys_config (tenant_id, config_key, config_value)
            VALUES ('migration-test', 'device_access_process_definition_id', ?)
            """, deviceDefinition.getId());

        Flyway unifiedTaskUpgrade = Flyway.configure()
            .dataSource(dataSource)
            .locations("classpath:db/migration")
            .validateOnMigrate(true)
            .load();
        assertEquals(30, unifiedTaskUpgrade.migrate().migrationsExecuted);
    }

    @Test
    void preservesExistingPlatformSchemaAndData() {
        List<String> preservedTables = List.of(
            "sys_user", "sys_group", "ci_model", "ci_instance", "change_doc",
            "wiki_space", "shared_file", "notification_message", "ops_duty_roster",
            "ops_holiday_calendar"
        );
        preservedTables.forEach(table -> assertTrue(tableExists(table), table + " must be preserved"));

        assertEquals("keep-me", jdbcTemplate.queryForObject("""
            SELECT config_value FROM sys_config
            WHERE tenant_id = 'migration-test' AND config_key = 'preserve.non_target_data'
            """, String.class));
        assertEquals(1, count("""
            SELECT COUNT(*) FROM workflow_process_binding
            WHERE tenant_id = 'migration-test'
              AND business_type = 'change_doc'
              AND process_definition_id = 'keep-definition'
              AND enabled
              AND NOT is_deleted
            """));
        assertEquals(1, jdbcTemplate.queryForObject("""
            SELECT COUNT(*) FROM workflow_process_binding
            WHERE tenant_id = 'migration-test'
              AND business_type = 'device_access'
              AND process_definition_id = ?
              AND process_definition_key = 'deviceAccessApproval'
              AND process_definition_version = ?
              AND enabled
              AND NOT is_deleted
            """, Integer.class, deviceDefinitionId, deviceDefinitionVersion));
        assertEquals(109, jdbcTemplate.queryForObject(
            "SELECT MAX(CAST(version AS INTEGER)) FROM flyway_schema_history", Integer.class));
    }

    @Test
    void addsUnifiedTaskSchemaPermissionsAndTemplates() {
        List<String> taskTables = List.of(
            "task_template", "task_template_version", "task_template_field",
            "task_plan", "task_plan_generation", "task_instance", "task_draft",
            "task_submission", "approval_scheme", "approval_round", "approval_action",
            "task_field_fact", "task_metric_definition", "task_analytics_dashboard",
            "task_automation_rule", "task_analytics_subscription"
        );
        taskTables.forEach(table -> assertTrue(tableExists(table), table + " must exist"));

        assertEquals(3, count("SELECT COUNT(*) FROM task_template WHERE builtin AND status = 'published'"));
        assertEquals(1, count("SELECT COUNT(*) FROM task_template WHERE code = 'basic_inspection'"));
        assertEquals(7, count("""
            SELECT COUNT(*) FROM sys_resource
            WHERE code IN ('task_template','task_plan','task','task_analytics','approval','work_item','calendar_settings')
            """));
        assertEquals(1, count("SELECT COUNT(*) FROM sys_permission WHERE code = 'workflow:approve'"));
        assertEquals(1, count("SELECT COUNT(*) FROM sys_permission WHERE code = 'task_analytics:share'"));
        assertEquals(1, count("""
            SELECT COUNT(*)
            FROM task_template_field field
            JOIN task_template_version version ON version.id = field.template_version_id
            JOIN task_template template ON template.id = version.template_id
            WHERE template.code = 'basic_inspection'
              AND field.field_key = 'inspection_result'
              AND field.field_type = 'single_select'
            """));
        assertEquals(1, count("""
            SELECT COUNT(*)
            FROM task_plan plan
            JOIN task_template_version version ON version.id = plan.template_version_id
            JOIN task_template template ON template.id = version.template_id
            WHERE plan.tenant_id = 'default'
              AND plan.name = '内置工作日报计划'
              AND plan.status = 'active'
              AND plan.schedule_type = 'daily'
              AND plan.schedule_config @> '{"workdaysOnly":true}'::jsonb
              AND plan.generation_mode = 'per_user'
              AND plan.assignment_rule @> '{"strategy":"all_users"}'::jsonb
              AND template.code = 'daily_work_report'
            """));
    }

    @Test
    void removesLegacyTargetSchemaPermissionsAndConfigAfterConsumerCutover() {
        List<String> targetTables = List.of(
            "daily_report", "daily_report_approval", "ops_schedule_rule",
            "ops_schedule_task", "ops_schedule_task_participant",
            "ops_schedule_checklist_item", "ops_schedule_task_log",
            "ops_schedule_task_link", "ops_schedule_notification_log",
            "ops_schedule_template"
        );
        targetTables.forEach(table -> assertFalse(tableExists(table),
            table + " must not survive WP-09 consumer cutover"));
        assertEquals(0, count("SELECT COUNT(*) FROM sys_permission WHERE code LIKE 'daily_report:%' OR code LIKE 'ops_calendar:%'"));
        assertEquals(0, count("SELECT COUNT(*) FROM sys_resource WHERE code IN ('daily_report', 'ops_calendar')"));
        assertEquals(0, count("SELECT COUNT(*) FROM sys_config WHERE config_key IN (" +
            "'notify.reminder.enabled', 'notify.reminder.cron', 'notify.reminder.template', " +
            "'daily_report_process_definition_id')"));
        assertEquals(0, count("SELECT COUNT(*) FROM information_schema.columns " +
            "WHERE table_name IN ('ops_duty_roster', 'ops_holiday_calendar') " +
            "AND column_name IN ('created_at', 'created_by', 'deleted_at', 'deleted_by')"));
        assertEquals(0, count("SELECT COUNT(*) FROM act_re_procdef WHERE key_ = 'dailyReportApproval'"));
        assertEquals(0, count("SELECT COUNT(*) FROM act_ru_execution " +
            "WHERE business_key_ = 'dailyReport:legacy-1'"));
        assertEquals(0, count("SELECT COUNT(*) FROM act_hi_procinst " +
            "WHERE business_key_ = 'dailyReport:legacy-1'"));
        assertEquals(0, count("SELECT COUNT(*) FROM act_hi_procinst " +
            "WHERE business_key_ = 'legacy-daily-nonstandard-key'"));
        assertEquals(1, count("SELECT COUNT(*) FROM act_re_procdef WHERE key_ = 'deviceAccessApproval'"));
        assertEquals(1, count("SELECT COUNT(*) FROM act_ru_execution " +
            "WHERE business_key_ = 'deviceAccess:keep-1'"));
        assertTrue(tableExists("ai_call_log"), "AI telemetry belongs to the AI module");
        assertEquals(1, count("SELECT COUNT(*) FROM information_schema.columns " +
            "WHERE table_name = 'backup_record' AND column_name = 'backup_type'"));
        assertEquals(5, count("SELECT COUNT(*) FROM information_schema.columns " +
            "WHERE table_name = 'backup_record' AND column_name IN " +
            "('is_deleted', 'deleted_at', 'deleted_by', 'updated_at', 'updated_by')"));
        assertEquals(1, count("SELECT COUNT(*) FROM sys_config " +
            "WHERE config_key = 'watermark.font_size'"));
        assertEquals(1, count("SELECT COUNT(*) FROM information_schema.columns " +
            "WHERE table_name = 'sys_config' AND column_name = 'description'"));
        assertEquals(0, count("SELECT COUNT(*) FROM information_schema.columns " +
            "WHERE table_name = 'task_metric_goal' AND column_name IN " +
            "('is_deleted', 'deleted_at', 'deleted_by', 'created_by', 'updated_by', 'created_at', 'updated_at')"));
        assertEquals(0, count("SELECT COUNT(*) FROM information_schema.columns " +
            "WHERE table_name = 'task_metric_binding' AND column_name IN ('created_by', 'created_at')"));
        assertEquals(0, count("SELECT COUNT(*) FROM information_schema.columns " +
            "WHERE table_name = 'task_relation' AND column_name = 'created_by'"));
        assertEquals(0, count("SELECT COUNT(*) FROM information_schema.columns " +
            "WHERE table_name = 'task_metric_definition' AND column_name IN " +
            "('created_by', 'updated_by', 'is_deleted', 'deleted_at', 'deleted_by')"));
        assertEquals(0, count("SELECT COUNT(*) FROM information_schema.columns " +
            "WHERE table_name = 'task_automation_rule' AND column_name IN " +
            "('lock_version', 'created_by', 'is_deleted', 'deleted_at', 'deleted_by')"));
        assertEquals(1, count("SELECT COUNT(*) FROM pg_indexes " +
            "WHERE schemaname = 'public' AND indexname = 'idx_task_automation_rule_active'"));
        assertEquals(0, count("SELECT COUNT(*) FROM information_schema.columns " +
            "WHERE table_name = 'task_analytics_subscription' AND column_name IN " +
            "('created_by', 'updated_by', 'is_deleted', 'deleted_at', 'deleted_by')"));
        assertEquals(1, count("SELECT COUNT(*) FROM pg_indexes " +
            "WHERE schemaname = 'public' AND indexname = 'idx_task_analytics_subscription_due'"));
        assertEquals(6, count("SELECT COUNT(*) FROM information_schema.columns " +
            "WHERE table_name = 'notification_message' AND column_name IN " +
            "('is_deleted', 'deleted_at', 'deleted_by', 'updated_at', 'created_by', 'updated_by')"));
        assertEquals(1, count("SELECT COUNT(*) FROM pg_indexes " +
            "WHERE schemaname = 'public' AND indexname = 'idx_notification_user_unread'"));
        assertEquals(0, count("SELECT COUNT(*) FROM notification_message " +
            "WHERE tenant_id = 'migration-test' AND title = 'obsolete notification'"));
    }

    @Test
    void consolidatesAuthorizationIntoTheTerminalRoleAndAclModel() {
        List<String> restoredTables = List.of(
            "sys_user_role", "wiki_space_acl", "wiki_page_acl", "shared_folder_acl",
            "authorization_migration_run", "authorization_migration_exception",
            "authorization_migration_lineage", "authorization_account_rollout",
            "authorization_decision_diff", "authorization_tenant_cutover"
        );
        restoredTables.forEach(table -> assertTrue(tableExists(table),
            table + " belongs to a non-task domain and must be preserved"));
        assertTrue(tableExists("sys_role_assignment"));
        assertTrue(tableExists("resource_acl_entry"));
        assertEquals(1, count("""
            SELECT COUNT(*) FROM pg_constraint
            WHERE conname = 'ck_resource_acl_subject_type'
              AND pg_get_constraintdef(oid) LIKE '%role%'
            """));
        assertEquals(1, count("""
            SELECT COUNT(*) FROM sys_user_group_membership
            WHERE tenant_id = 'migration-test' AND user_id = ? AND group_id = ?
              AND origin_type = 'migration' AND NOT is_deleted
            """, legacyAuthorizationUserId, legacyAuthorizationGroupId));
        assertEquals(1, count("""
            SELECT COUNT(*) FROM sys_role_assignment
            WHERE tenant_id = 'migration-test' AND user_id = ? AND role_id = ?
              AND scope_type = 'group' AND scope_id = ? AND origin_type = 'migration'
              AND NOT is_deleted
            """, legacyAuthorizationUserId, legacyAuthorizationRoleId, legacyAuthorizationGroupId));
        assertEquals(0, count("""
            SELECT COUNT(*) FROM (
                SELECT owner_user_id, owner_group_id, permission_mode FROM wiki_space
                WHERE tenant_id = 'migration-test' AND NOT is_deleted
                UNION ALL
                SELECT owner_user_id, owner_group_id, permission_mode FROM wiki_page
                WHERE tenant_id = 'migration-test' AND NOT is_deleted
                UNION ALL
                SELECT owner_user_id, owner_group_id, permission_mode FROM shared_folder
                WHERE tenant_id = 'migration-test' AND NOT is_deleted
                UNION ALL
                SELECT owner_user_id, owner_group_id, permission_mode FROM shared_file
                WHERE tenant_id = 'migration-test' AND NOT is_deleted
            ) resources
            WHERE owner_user_id IS NULL OR owner_group_id IS NULL OR permission_mode IS NULL
            """));
        assertEquals(7, jdbcTemplate.queryForObject("""
            SELECT permissions FROM resource_acl_entry
            WHERE tenant_id = 'migration-test' AND resource_type = 'wiki_space' AND resource_id = ?
              AND entry_type = 'access' AND subject_type = 'role' AND subject_id = ? AND NOT is_deleted
            """, Integer.class, legacyAuthorizationWikiSpaceId, legacyAuthorizationRoleId));
        assertEquals(6, jdbcTemplate.queryForObject("""
            SELECT permissions FROM resource_acl_entry
            WHERE tenant_id = 'migration-test' AND resource_type = 'wiki_page' AND resource_id = ?
              AND entry_type = 'access' AND subject_type = 'user' AND subject_id = ? AND NOT is_deleted
            """, Integer.class, legacyAuthorizationWikiPageId, legacyAuthorizationUserId));
        assertEquals(5, jdbcTemplate.queryForObject("""
            SELECT permissions FROM resource_acl_entry
            WHERE tenant_id = 'migration-test' AND resource_type = 'shared_folder' AND resource_id = ?
              AND entry_type = 'access' AND subject_type = 'group' AND subject_id = ? AND NOT is_deleted
            """, Integer.class, legacyAuthorizationSharedFolderId, legacyAuthorizationGroupId));
        assertEquals(1, count("""
            SELECT COUNT(*)
            FROM sys_role_assignment assignment
            JOIN resource_acl_entry acl ON acl.tenant_id = assignment.tenant_id
              AND acl.subject_type = 'role' AND acl.subject_id = assignment.role_id AND NOT acl.is_deleted
            JOIN sys_user_group_membership membership ON membership.tenant_id = assignment.tenant_id
              AND membership.user_id = assignment.user_id AND membership.group_id = assignment.scope_id
              AND NOT membership.is_deleted
            WHERE assignment.tenant_id = 'migration-test' AND assignment.user_id = ?
              AND assignment.role_id = ? AND assignment.scope_type = 'group'
              AND assignment.scope_id = ? AND acl.resource_type = 'wiki_space'
              AND acl.resource_id = ? AND (acl.permissions & 6) = 6
              AND NOT assignment.is_deleted
            """, legacyAuthorizationUserId, legacyAuthorizationRoleId, legacyAuthorizationGroupId,
            legacyAuthorizationWikiSpaceId));
    }

    @Test
    void enforcesNewUniquenessContracts() {
        assertEquals(1, count("""
            SELECT COUNT(*) FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname = 'uq_task_template_version'
              AND indexdef LIKE '%tenant_id, template_id, version%'
            """));
        assertEquals(1, count("""
            SELECT COUNT(*) FROM pg_constraint
            WHERE conname = 'ck_task_metric_goal_scope'
              AND pg_get_constraintdef(oid) LIKE '%user%template%'
            """));
        assertEquals(1, count("""
            SELECT COUNT(*) FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname = 'uq_task_plan_generation_occurrence'
              AND indexdef LIKE '%tenant_id, plan_id, occurrence_key%'
            """));
        assertEquals(1, count("""
            SELECT COUNT(*) FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname = 'uq_approval_round_process'
              AND indexdef LIKE '%tenant_id, process_instance_id%'
            """));
        assertEquals(1, count("""
            SELECT COUNT(*) FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname = 'uq_approval_action_flowable_task'
              AND indexdef LIKE '%tenant_id, flowable_task_id%'
            """));
        assertEquals(1, count("""
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'task_instance'
              AND column_name = 'current_approval_round_id'
            """));
        assertEquals(0, count("""
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'approval_action'
              AND column_name = 'task_key'
            """));
        assertEquals(1, count("""
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'task_field_fact'
              AND column_name = 'row_key'
            """));
        assertEquals(1, count("""
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'task_field_fact'
              AND column_name = 'owner_group_name'
            """));
        assertEquals(1, count("""
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'task_metric_fact'
              AND column_name = 'business_date'
            """));
        assertEquals(1, count("""
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'task_metric_fact'
              AND column_name = 'denominator_field_fact_id'
            """));
        assertEquals(1, count("""
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'task_automation_execution'
              AND column_name = 'dedupe_key'
            """));
        assertEquals(1, count("""
            SELECT COUNT(*) FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname = 'uq_task_automation_execution_dedupe'
            """));
        assertEquals(1, count("""
            SELECT COUNT(*) FROM pg_constraint
            WHERE conname = 'ck_task_relation_no_self_reference'
            """));
        assertEquals(1, count("""
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'task_automation_execution'
              AND column_name = 'source_attributes'
            """));
        assertEquals(1, count("""
            SELECT COUNT(*) FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname = 'idx_task_automation_execution_source_event'
            """));
        assertEquals(1, count("""
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'task_notification_delivery'
              AND column_name = 'subscription_id'
            """));
        assertEquals(1, count("""
            SELECT COUNT(*) FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname = 'idx_task_notification_delivery_subscription_batch'
            """));
        assertEquals(1, count("""
            SELECT COUNT(*) FROM pg_constraint
            WHERE conname = 'ck_task_automation_rule_trigger'
              AND pg_get_constraintdef(oid) NOT LIKE '%schedule%'
            """));
    }

    private static boolean tableExists(String tableName) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject(
            "SELECT to_regclass('public.' || ?) IS NOT NULL", Boolean.class, tableName));
    }

    private static void seedLegacyAuthorizationData() {
        legacyAuthorizationGroupId = jdbcTemplate.queryForObject("""
            INSERT INTO sys_group (tenant_id, code, name, description, group_type, is_builtin)
            VALUES ('migration-test', 'legacy_auth_group', 'Legacy authorization group',
                    'V93 conversion sentinel', 'business', FALSE)
            RETURNING id
            """, Long.class);
        legacyAuthorizationUserId = jdbcTemplate.queryForObject("""
            INSERT INTO sys_user (tenant_id, group_id, username, password, real_name, status)
            VALUES ('migration-test', ?, 'legacy-auth-user', 'not-used', 'Legacy authorization user', 1)
            RETURNING id
            """, Long.class, legacyAuthorizationGroupId);
        legacyAuthorizationRoleId = jdbcTemplate.queryForObject("""
            INSERT INTO sys_role (tenant_id, name, code, scope, description, role_type, is_builtin, is_legacy)
            VALUES ('migration-test', 'Legacy authorization role', 'legacy_auth_role', 'group',
                    'V93 conversion sentinel', 'functional', FALSE, FALSE)
            RETURNING id
            """, Long.class);
        jdbcTemplate.update("INSERT INTO sys_user_role (user_id, role_id) VALUES (?, ?)",
            legacyAuthorizationUserId, legacyAuthorizationRoleId);
        legacyAuthorizationWikiSpaceId = jdbcTemplate.queryForObject("""
            INSERT INTO wiki_space (tenant_id, name, description, created_by)
            VALUES ('migration-test', 'Legacy authorization space', 'V93 conversion sentinel', ?)
            RETURNING id
            """, Long.class, legacyAuthorizationUserId);
        legacyAuthorizationWikiPageId = jdbcTemplate.queryForObject("""
            INSERT INTO wiki_page (tenant_id, space_id, slug, title, content, created_by)
            VALUES ('migration-test', ?, 'legacy-authorization-page', 'Legacy authorization page', '', ?)
            RETURNING id
            """, Long.class, legacyAuthorizationWikiSpaceId, legacyAuthorizationUserId);
        legacyAuthorizationSharedFolderId = jdbcTemplate.queryForObject("""
            INSERT INTO shared_folder (tenant_id, name, normalized_name, created_by)
            VALUES ('migration-test', 'Legacy authorization folder', 'legacy authorization folder', ?)
            RETURNING id
            """, Long.class, legacyAuthorizationUserId);
        jdbcTemplate.update("""
            INSERT INTO wiki_space_acl (tenant_id, space_id, subject_type, subject_id, permissions, created_by)
            VALUES ('migration-test', ?, 'role', ?, '[\"read\", \"write\"]'::jsonb, ?)
            """, legacyAuthorizationWikiSpaceId, legacyAuthorizationRoleId, legacyAuthorizationUserId);
        jdbcTemplate.update("""
            INSERT INTO wiki_page_acl (tenant_id, page_id, subject_type, subject_id, permissions, created_by)
            VALUES ('migration-test', ?, 'user', ?, '[\"read\", \"write\"]'::jsonb, ?)
            """, legacyAuthorizationWikiPageId, legacyAuthorizationUserId, legacyAuthorizationUserId);
        jdbcTemplate.update("""
            INSERT INTO shared_folder_acl (tenant_id, folder_id, subject_type, subject_id, permissions, created_by)
            VALUES ('migration-test', ?, 'group', ?, '[\"read\"]'::jsonb, ?)
            """, legacyAuthorizationSharedFolderId, legacyAuthorizationGroupId, legacyAuthorizationUserId);
    }

    private static int count(String sql, Object... args) {
        return jdbcTemplate.queryForObject(sql, Integer.class, args);
    }

    @AfterAll
    static void closeFlowable() {
        if (flowable != null) {
            flowable.close();
        }
    }

    private static String processXml(String processId) {
        return """
            <?xml version="1.0" encoding="UTF-8"?>
            <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
                targetNamespace="https://cwgsyw.example/workflow">
              <process id="%s" isExecutable="true">
                <startEvent id="start"/>
                <sequenceFlow id="flow-1" sourceRef="start" targetRef="review"/>
                <userTask id="review" name="Review"/>
              </process>
            </definitions>
            """.formatted(processId);
    }
}
