-- Auditable group lifecycle database boundary.
-- Flowable-owned tables are intentionally excluded; application validation covers their writers.

CREATE INDEX idx_sys_group_tenant_archived
    ON sys_group(tenant_id, deleted_at DESC, id)
    WHERE is_deleted;

UPDATE sys_resource
SET actions = actions || '["purge"]'::jsonb
WHERE code = 'group'
  AND NOT actions ? 'purge';

INSERT INTO sys_permission (resource_id, action, code, name)
SELECT id, 'purge', 'group:purge', '用户组-永久清除'
FROM sys_resource
WHERE code = 'group'
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT role.id, permission.id
FROM sys_role role
JOIN sys_permission permission ON permission.code = 'group:purge'
WHERE role.scope = 'platform'
  AND role.role_type = 'management'
  AND role.is_builtin
  AND NOT role.is_deleted
ON CONFLICT DO NOTHING;

CREATE FUNCTION require_active_business_group(
    p_tenant_id VARCHAR,
    p_group_id BIGINT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_group_id IS NULL THEN
        RETURN;
    END IF;

    PERFORM 1
    FROM sys_group
    WHERE tenant_id = p_tenant_id
      AND id = p_group_id
      AND NOT is_deleted
      AND group_type = 'business'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P7201',
            MESSAGE = 'GROUP_REFERENCE_INACTIVE',
            DETAIL = format('tenantId=%s, groupId=%s', p_tenant_id, p_group_id);
    END IF;
END;
$$;

CREATE FUNCTION parse_group_reference_id(
    p_value JSONB
) RETURNS BIGINT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    value_type TEXT;
    value_text TEXT;
    group_id BIGINT;
BEGIN
    value_type := jsonb_typeof(p_value);
    IF value_type NOT IN ('number', 'string') THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P7202',
            MESSAGE = 'GROUP_REFERENCE_INVALID',
            DETAIL = 'groupId must be a positive integer JSON number or numeric string';
    END IF;

    value_text := p_value #>> '{}';
    IF value_text !~ '^[1-9][0-9]*$' THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P7202',
            MESSAGE = 'GROUP_REFERENCE_INVALID',
            DETAIL = 'groupId must be a positive integer JSON number or numeric string';
    END IF;

    BEGIN
        group_id := value_text::BIGINT;
    EXCEPTION
        WHEN numeric_value_out_of_range THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P7202',
                MESSAGE = 'GROUP_REFERENCE_INVALID',
                DETAIL = 'groupId is outside the BIGINT range';
    END;

    RETURN group_id;
END;
$$;

CREATE FUNCTION require_active_visible_groups(
    p_tenant_id VARCHAR,
    p_visible_groups JSONB,
    p_owner_group_id BIGINT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    group_id BIGINT;
BEGIN
    IF p_visible_groups IS NULL OR jsonb_typeof(p_visible_groups) <> 'array' THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P7202',
            MESSAGE = 'GROUP_REFERENCE_INVALID',
            DETAIL = 'visibleGroups must be a JSON array';
    END IF;

    FOR group_id IN
        SELECT DISTINCT reference_id
        FROM (
            SELECT parse_group_reference_id(value) AS reference_id
            FROM jsonb_array_elements(p_visible_groups)
            UNION ALL
            SELECT p_owner_group_id
            WHERE p_owner_group_id IS NOT NULL
        ) group_references
        ORDER BY reference_id
    LOOP
        PERFORM require_active_business_group(p_tenant_id, group_id);
    END LOOP;
END;
$$;

CREATE FUNCTION require_active_ops_rule_groups(
    p_tenant_id VARCHAR,
    p_assignee_rule TEXT,
    p_recipient_rule TEXT,
    p_escalation_rule TEXT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    rules JSONB;
    group_id BIGINT;
BEGIN
    BEGIN
        rules := jsonb_build_array(
            COALESCE(p_assignee_rule, '{}')::JSONB,
            COALESCE(p_recipient_rule, '{}')::JSONB,
            COALESCE(p_escalation_rule, '{}')::JSONB
        );
    EXCEPTION
        WHEN invalid_text_representation THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P7202',
                MESSAGE = 'GROUP_REFERENCE_INVALID',
                DETAIL = 'ops group rule must be valid JSON';
    END;

    FOR group_id IN
        SELECT DISTINCT parse_group_reference_id(value)
        FROM jsonb_path_query(rules, 'strict $.**.groupId') AS value
        ORDER BY parse_group_reference_id(value)
    LOOP
        PERFORM require_active_business_group(p_tenant_id, group_id);
    END LOOP;
END;
$$;

CREATE FUNCTION enforce_active_group_scalar_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    new_row JSONB := to_jsonb(NEW);
    old_row JSONB;
    reference_column TEXT := TG_ARGV[0];
    reference_kind TEXT := COALESCE(TG_ARGV[1], 'scalar');
    new_active BOOLEAN;
    old_active BOOLEAN := FALSE;
    new_applies BOOLEAN;
    old_applies BOOLEAN := FALSE;
    new_group_id BIGINT;
    old_group_id BIGINT;
BEGIN
    new_active := NOT COALESCE((new_row ->> 'is_deleted')::BOOLEAN, FALSE);
    new_applies := CASE reference_kind
        WHEN 'role_assignment' THEN new_row ->> 'scope_type' = 'group'
        WHEN 'acl' THEN new_row ->> 'subject_type' = 'group'
        ELSE TRUE
    END;

    IF NOT new_active OR NOT new_applies OR new_row ->> reference_column IS NULL THEN
        RETURN NEW;
    END IF;

    new_group_id := (new_row ->> reference_column)::BIGINT;

    IF TG_OP = 'UPDATE' THEN
        old_row := to_jsonb(OLD);
        old_active := NOT COALESCE((old_row ->> 'is_deleted')::BOOLEAN, FALSE);
        old_applies := CASE reference_kind
            WHEN 'role_assignment' THEN old_row ->> 'scope_type' = 'group'
            WHEN 'acl' THEN old_row ->> 'subject_type' = 'group'
            ELSE TRUE
        END;
        old_group_id := (old_row ->> reference_column)::BIGINT;

        IF old_active
           AND old_applies
           AND old_group_id IS NOT DISTINCT FROM new_group_id
           AND old_row ->> 'tenant_id' IS NOT DISTINCT FROM new_row ->> 'tenant_id' THEN
            RETURN NEW;
        END IF;
    END IF;

    PERFORM require_active_business_group(new_row ->> 'tenant_id', new_group_id);
    RETURN NEW;
END;
$$;

CREATE FUNCTION enforce_active_shared_file_group_references()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    should_validate BOOLEAN;
BEGIN
    IF NEW.is_deleted THEN
        RETURN NEW;
    END IF;

    should_validate := TG_OP = 'INSERT';
    IF TG_OP = 'UPDATE' THEN
        should_validate := OLD.is_deleted
            OR OLD.tenant_id IS DISTINCT FROM NEW.tenant_id
            OR OLD.owner_group_id IS DISTINCT FROM NEW.owner_group_id
            OR OLD.visible_groups IS DISTINCT FROM NEW.visible_groups;
    END IF;

    IF should_validate THEN
        PERFORM require_active_visible_groups(
            NEW.tenant_id,
            NEW.visible_groups,
            NEW.owner_group_id
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION enforce_active_ops_rule_group_references()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    should_validate BOOLEAN;
BEGIN
    IF NEW.is_deleted OR NOT NEW.enabled THEN
        RETURN NEW;
    END IF;

    should_validate := TG_OP = 'INSERT';
    IF TG_OP = 'UPDATE' THEN
        should_validate := OLD.is_deleted
            OR NOT OLD.enabled
            OR OLD.tenant_id IS DISTINCT FROM NEW.tenant_id
            OR OLD.assignee_rule IS DISTINCT FROM NEW.assignee_rule
            OR OLD.recipient_rule IS DISTINCT FROM NEW.recipient_rule
            OR OLD.escalation_rule IS DISTINCT FROM NEW.escalation_rule;
    END IF;

    IF should_validate THEN
        PERFORM require_active_ops_rule_groups(
            NEW.tenant_id,
            NEW.assignee_rule,
            NEW.recipient_rule,
            NEW.escalation_rule
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sys_user_active_group
    BEFORE INSERT OR UPDATE ON sys_user
    FOR EACH ROW EXECUTE FUNCTION enforce_active_group_scalar_reference('group_id');

CREATE TRIGGER trg_sys_user_group_membership_active_group
    BEFORE INSERT OR UPDATE ON sys_user_group_membership
    FOR EACH ROW EXECUTE FUNCTION enforce_active_group_scalar_reference('group_id');

CREATE TRIGGER trg_sys_role_assignment_active_group
    BEFORE INSERT OR UPDATE ON sys_role_assignment
    FOR EACH ROW EXECUTE FUNCTION enforce_active_group_scalar_reference('scope_id', 'role_assignment');

CREATE TRIGGER trg_daily_report_active_group
    BEFORE INSERT OR UPDATE ON daily_report
    FOR EACH ROW EXECUTE FUNCTION enforce_active_group_scalar_reference('group_id');

CREATE TRIGGER trg_device_active_group
    BEFORE INSERT OR UPDATE ON device
    FOR EACH ROW EXECUTE FUNCTION enforce_active_group_scalar_reference('group_id');

CREATE TRIGGER trg_device_credential_active_group
    BEFORE INSERT OR UPDATE ON device_credential
    FOR EACH ROW EXECUTE FUNCTION enforce_active_group_scalar_reference('group_id');

CREATE TRIGGER trg_ops_schedule_task_active_group
    BEFORE INSERT OR UPDATE ON ops_schedule_task
    FOR EACH ROW EXECUTE FUNCTION enforce_active_group_scalar_reference('group_id');

CREATE TRIGGER trg_ops_duty_roster_active_group
    BEFORE INSERT OR UPDATE ON ops_duty_roster
    FOR EACH ROW EXECUTE FUNCTION enforce_active_group_scalar_reference('group_id');

CREATE TRIGGER trg_wiki_space_owner_active_group
    BEFORE INSERT OR UPDATE ON wiki_space
    FOR EACH ROW EXECUTE FUNCTION enforce_active_group_scalar_reference('owner_group_id');

CREATE TRIGGER trg_wiki_page_owner_active_group
    BEFORE INSERT OR UPDATE ON wiki_page
    FOR EACH ROW EXECUTE FUNCTION enforce_active_group_scalar_reference('owner_group_id');

CREATE TRIGGER trg_shared_folder_owner_active_group
    BEFORE INSERT OR UPDATE ON shared_folder
    FOR EACH ROW EXECUTE FUNCTION enforce_active_group_scalar_reference('owner_group_id');

CREATE TRIGGER trg_resource_acl_entry_active_group
    BEFORE INSERT OR UPDATE ON resource_acl_entry
    FOR EACH ROW EXECUTE FUNCTION enforce_active_group_scalar_reference('subject_id', 'acl');

CREATE TRIGGER trg_wiki_page_acl_active_group
    BEFORE INSERT OR UPDATE ON wiki_page_acl
    FOR EACH ROW EXECUTE FUNCTION enforce_active_group_scalar_reference('subject_id', 'acl');

CREATE TRIGGER trg_wiki_space_acl_active_group
    BEFORE INSERT OR UPDATE ON wiki_space_acl
    FOR EACH ROW EXECUTE FUNCTION enforce_active_group_scalar_reference('subject_id', 'acl');

CREATE TRIGGER trg_shared_folder_acl_active_group
    BEFORE INSERT OR UPDATE ON shared_folder_acl
    FOR EACH ROW EXECUTE FUNCTION enforce_active_group_scalar_reference('subject_id', 'acl');

CREATE TRIGGER trg_shared_file_active_groups
    BEFORE INSERT OR UPDATE ON shared_file
    FOR EACH ROW EXECUTE FUNCTION enforce_active_shared_file_group_references();

CREATE TRIGGER trg_ops_schedule_rule_active_groups
    BEFORE INSERT OR UPDATE ON ops_schedule_rule
    FOR EACH ROW EXECUTE FUNCTION enforce_active_ops_rule_group_references();
