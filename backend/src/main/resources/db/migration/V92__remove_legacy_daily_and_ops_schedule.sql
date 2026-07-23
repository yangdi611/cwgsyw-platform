-- WP-09 consumer cutover: remove only the legacy daily-report and old schedule
-- domain. Non-target data is protected in this migration, not permanently exempt
-- from the final schema audit. Roster and holidays remain because they have
-- verified calendar-settings and unified-task consumers; every other non-target
-- object requires independent end-state evidence before it can be retained.

-- Materialize the remaining legacy config bindings into the authoritative table
-- before removing all configuration-based workflow fallback keys.
DO $$
BEGIN
    IF to_regclass('public.act_re_procdef') IS NOT NULL THEN
        INSERT INTO workflow_process_binding (
            tenant_id, business_type, process_definition_id, process_definition_key,
            process_definition_version, enabled, created_at, updated_at
        )
        SELECT config.tenant_id,
               CASE config.config_key
                   WHEN 'wiki_publish_process_definition_id' THEN 'wiki_page'
                   WHEN 'change_doc_process_definition_id' THEN 'change_doc'
                   WHEN 'device_access_process_definition_id' THEN 'device_access'
               END,
               config.config_value,
               definition.key_,
               definition.version_,
               TRUE,
               NOW(), NOW()
        FROM sys_config config
        JOIN act_re_procdef definition ON definition.id_ = config.config_value
        WHERE config.config_key IN (
            'wiki_publish_process_definition_id',
            'change_doc_process_definition_id',
            'device_access_process_definition_id'
        )
          AND config.config_value IS NOT NULL
          AND BTRIM(config.config_value) <> ''
          AND NOT EXISTS (
              SELECT 1
              FROM workflow_process_binding binding
              WHERE binding.tenant_id = config.tenant_id
                AND binding.business_type = CASE config.config_key
                    WHEN 'wiki_publish_process_definition_id' THEN 'wiki_page'
                    WHEN 'change_doc_process_definition_id' THEN 'change_doc'
                    WHEN 'device_access_process_definition_id' THEN 'device_access'
                END
                AND NOT binding.is_deleted
          );
    END IF;

    IF EXISTS (
        SELECT 1
        FROM sys_config config
        WHERE config.config_key IN (
            'wiki_publish_process_definition_id',
            'change_doc_process_definition_id',
            'device_access_process_definition_id'
        )
          AND config.config_value IS NOT NULL
          AND BTRIM(config.config_value) <> ''
          AND NOT EXISTS (
              SELECT 1
              FROM workflow_process_binding binding
              WHERE binding.tenant_id = config.tenant_id
                AND binding.business_type = CASE config.config_key
                    WHEN 'wiki_publish_process_definition_id' THEN 'wiki_page'
                    WHEN 'change_doc_process_definition_id' THEN 'change_doc'
                    WHEN 'device_access_process_definition_id' THEN 'device_access'
                END
                AND NOT binding.is_deleted
          )
    ) THEN
        RAISE EXCEPTION
            'Cannot remove legacy workflow config before materializing every non-target process binding'
            USING ERRCODE = 'P7203';
    END IF;
END $$;

-- Shared-table rows that belong only to deleted business types.
DELETE FROM workflow_business_instance WHERE business_type = 'daily_report';
DELETE FROM workflow_process_binding WHERE business_type = 'daily_report';
DELETE FROM workflow_template_instance WHERE business_type = 'daily_report';

-- Flowable is managed outside the Flyway chain in some deployments. Its
-- runtime tables have foreign keys to executions, so clean the exact legacy
-- instances leaf-to-root instead of deleting ACT_RU_EXECUTION directly.
DO $$
DECLARE
    flowable_table TEXT;
    instance_column TEXT;
BEGIN
    CREATE TEMP TABLE v92_legacy_daily_flowable_instances (
        id VARCHAR(64) PRIMARY KEY
    ) ON COMMIT DROP;
    CREATE TEMP TABLE v92_legacy_daily_flowable_definitions (
        id VARCHAR(64) PRIMARY KEY,
        deployment_id VARCHAR(64)
    ) ON COMMIT DROP;

    IF to_regclass('public.act_re_procdef') IS NOT NULL THEN
        INSERT INTO v92_legacy_daily_flowable_definitions (id, deployment_id)
        SELECT id_, deployment_id_
        FROM act_re_procdef
        WHERE key_ = 'dailyReportApproval';
    END IF;
    IF to_regclass('public.act_ru_execution') IS NOT NULL THEN
        INSERT INTO v92_legacy_daily_flowable_instances (id)
        SELECT proc_inst_id_
        FROM act_ru_execution
        WHERE business_key_ ~ '^(dailyReport|daily_report):'
           OR proc_def_id_ IN (SELECT id FROM v92_legacy_daily_flowable_definitions)
        ON CONFLICT DO NOTHING;
    END IF;
    IF to_regclass('public.act_hi_procinst') IS NOT NULL THEN
        INSERT INTO v92_legacy_daily_flowable_instances (id)
        SELECT proc_inst_id_
        FROM act_hi_procinst
        WHERE business_key_ ~ '^(dailyReport|daily_report):'
           OR proc_def_id_ IN (SELECT id FROM v92_legacy_daily_flowable_definitions)
        ON CONFLICT DO NOTHING;
    END IF;

    FOREACH flowable_table IN ARRAY ARRAY[
        'act_ru_identitylink', 'act_ru_variable', 'act_ru_task',
        'act_ru_job', 'act_ru_timer_job', 'act_ru_suspended_job',
        'act_ru_deadletter_job', 'act_ru_external_worker_job',
        'act_ru_event_subscr', 'act_ru_actinst'
    ] LOOP
        IF to_regclass('public.' || flowable_table) IS NOT NULL THEN
            SELECT column_name INTO instance_column
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = flowable_table
              AND column_name IN ('proc_inst_id_', 'process_instance_id_')
            ORDER BY CASE column_name
                WHEN 'proc_inst_id_' THEN 1
                WHEN 'process_instance_id_' THEN 2
            END
            LIMIT 1;
            IF instance_column IS NOT NULL THEN
                EXECUTE format(
                    'DELETE FROM %I WHERE %I IN (SELECT id FROM v92_legacy_daily_flowable_instances)',
                    flowable_table, instance_column
                );
            END IF;
        END IF;
    END LOOP;

    FOREACH flowable_table IN ARRAY ARRAY[
        'act_hi_actinst', 'act_hi_detail', 'act_hi_comment',
        'act_hi_attachment', 'act_hi_varinst', 'act_hi_identitylink',
        'act_hi_taskinst'
    ] LOOP
        IF to_regclass('public.' || flowable_table) IS NOT NULL THEN
            SELECT column_name INTO instance_column
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = flowable_table
              AND column_name IN ('proc_inst_id_', 'process_instance_id_')
            ORDER BY CASE column_name
                WHEN 'proc_inst_id_' THEN 1
                WHEN 'process_instance_id_' THEN 2
            END
            LIMIT 1;
            IF instance_column IS NOT NULL THEN
                EXECUTE format(
                    'DELETE FROM %I WHERE %I IN (SELECT id FROM v92_legacy_daily_flowable_instances)',
                    flowable_table, instance_column
                );
            END IF;
        END IF;
    END LOOP;

    IF to_regclass('public.act_evt_log') IS NOT NULL THEN
        DELETE FROM act_evt_log
        WHERE proc_inst_id_ IN (SELECT id FROM v92_legacy_daily_flowable_instances)
           OR proc_def_id_ IN (SELECT id FROM v92_legacy_daily_flowable_definitions);
    END IF;
    IF to_regclass('public.act_ru_execution') IS NOT NULL THEN
        DELETE FROM act_ru_execution
        WHERE proc_inst_id_ IN (SELECT id FROM v92_legacy_daily_flowable_instances);
    END IF;
    IF to_regclass('public.act_hi_procinst') IS NOT NULL THEN
        DELETE FROM act_hi_procinst
        WHERE proc_inst_id_ IN (SELECT id FROM v92_legacy_daily_flowable_instances);
    END IF;
    IF to_regclass('public.act_procdef_info') IS NOT NULL THEN
        DELETE FROM act_procdef_info
        WHERE proc_def_id_ IN (SELECT id FROM v92_legacy_daily_flowable_definitions);
    END IF;
    IF to_regclass('public.act_re_procdef') IS NOT NULL THEN
        DELETE FROM act_re_procdef
        WHERE id_ IN (SELECT id FROM v92_legacy_daily_flowable_definitions);
    END IF;

    -- A deployment can contain non-target definitions or models. Delete it and
    -- its resources only after proving it has no remaining consumer.
    IF to_regclass('public.act_ge_bytearray') IS NOT NULL
       AND to_regclass('public.act_re_procdef') IS NOT NULL
       AND to_regclass('public.act_re_model') IS NOT NULL THEN
        DELETE FROM act_ge_bytearray byte_array
        WHERE byte_array.deployment_id_ IN (
            SELECT definition.deployment_id
            FROM v92_legacy_daily_flowable_definitions definition
            WHERE definition.deployment_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM act_re_procdef remaining
                  WHERE remaining.deployment_id_ = definition.deployment_id
              )
              AND NOT EXISTS (
                  SELECT 1 FROM act_re_model model
                  WHERE model.deployment_id_ = definition.deployment_id
              )
        );
    END IF;
    IF to_regclass('public.act_re_deployment') IS NOT NULL
       AND to_regclass('public.act_re_procdef') IS NOT NULL
       AND to_regclass('public.act_re_model') IS NOT NULL THEN
        DELETE FROM act_re_deployment deployment
        WHERE deployment.id_ IN (
            SELECT definition.deployment_id
            FROM v92_legacy_daily_flowable_definitions definition
            WHERE definition.deployment_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM act_re_procdef remaining
                  WHERE remaining.deployment_id_ = definition.deployment_id
              )
              AND NOT EXISTS (
                  SELECT 1 FROM act_re_model model
                  WHERE model.deployment_id_ = definition.deployment_id
              )
        );
    END IF;
END $$;

UPDATE workflow_template
SET supported_business_types = COALESCE(
    (
        SELECT jsonb_agg(value)
        FROM jsonb_array_elements_text(supported_business_types::jsonb) AS value
        WHERE value <> 'daily_report'
    ),
    '[]'::jsonb
)::text
WHERE supported_business_types::jsonb ? 'daily_report';

DELETE FROM notification_message
WHERE ref_type IN ('daily_report', 'ops_schedule_task');

DELETE FROM audit_log
WHERE target_type IN (
    'daily_report', 'daily_report_approval', 'daily_report_export',
    'ops_schedule_rule', 'ops_schedule_task', 'ops_schedule_template'
);

DELETE FROM sys_config
WHERE config_key IN (
    'notify.reminder.enabled', 'notify.reminder.cron', 'notify.reminder.template',
    'daily_report_process_definition_id', 'wiki_publish_process_definition_id',
    'change_doc_process_definition_id', 'device_access_process_definition_id'
);

-- RBAC relations must be removed before deleting their target permissions/resources.
DELETE FROM sys_role_permission
WHERE permission_id IN (
    SELECT id FROM sys_permission
    WHERE code LIKE 'daily_report:%' OR code LIKE 'ops_calendar:%'
);
DELETE FROM sys_permission
WHERE code LIKE 'daily_report:%' OR code LIKE 'ops_calendar:%';
DELETE FROM sys_resource WHERE code IN ('daily_report', 'ops_calendar');

-- Drop only legacy group constraints/functions. Shared group functions remain.
DROP TRIGGER IF EXISTS trg_daily_report_active_group ON daily_report;
DROP TRIGGER IF EXISTS trg_ops_schedule_task_active_group ON ops_schedule_task;
DROP TRIGGER IF EXISTS trg_ops_schedule_rule_active_groups ON ops_schedule_rule;
DROP FUNCTION IF EXISTS enforce_active_ops_rule_group_references();
DROP FUNCTION IF EXISTS require_active_ops_rule_groups(VARCHAR, TEXT, TEXT, TEXT);

-- Unified-task tables own group references too. Keep the existing lifecycle
-- invariant: active rows may only point to an active business group.
CREATE TRIGGER trg_task_template_owner_active_group
    BEFORE INSERT OR UPDATE ON task_template
    FOR EACH ROW EXECUTE FUNCTION enforce_active_group_scalar_reference('owner_group_id');
CREATE TRIGGER trg_approval_scheme_owner_active_group
    BEFORE INSERT OR UPDATE ON approval_scheme
    FOR EACH ROW EXECUTE FUNCTION enforce_active_group_scalar_reference('owner_group_id');
CREATE TRIGGER trg_task_instance_active_group
    BEFORE INSERT OR UPDATE ON task_instance
    FOR EACH ROW EXECUTE FUNCTION enforce_active_group_scalar_reference('group_id');
CREATE TRIGGER trg_task_analytics_dashboard_owner_active_group
    BEFORE INSERT OR UPDATE ON task_analytics_dashboard
    FOR EACH ROW EXECUTE FUNCTION enforce_active_group_scalar_reference('owner_group_id');

-- Delete child tables first; no CASCADE is used so migration failures expose
-- unexpected dependencies rather than deleting shared objects.
DROP TABLE ops_schedule_notification_log;
DROP TABLE ops_schedule_task_link;
DROP TABLE ops_schedule_task_log;
DROP TABLE ops_schedule_checklist_item;
DROP TABLE ops_schedule_task_participant;
DROP TABLE ops_schedule_task;
DROP TABLE ops_schedule_template;
DROP TABLE ops_schedule_rule;
DROP TABLE daily_report_approval;
DROP TABLE daily_report;

-- Roster and holiday remain authoritative calendar-settings collections. These
-- unconsumed columns had no restore/history API and are superseded by audit_log.
ALTER TABLE ops_duty_roster
    DROP COLUMN created_at,
    DROP COLUMN created_by,
    DROP COLUMN deleted_at,
    DROP COLUMN deleted_by;
ALTER TABLE ops_holiday_calendar
    DROP COLUMN created_at,
    DROP COLUMN created_by,
    DROP COLUMN deleted_at,
    DROP COLUMN deleted_by;
