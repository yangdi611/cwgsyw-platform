package com.cwgsyw.platform.module.org;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class GroupReferenceRegistry {
    public static final String VERSION = "group-reference-registry/v1";

    private static final String OPS_RULE_MATCH = """
        SELECT COUNT(*) FROM ops_schedule_rule rule
        WHERE rule.tenant_id=? %s
          AND EXISTS (
              SELECT 1
              FROM jsonb_path_query(
                  jsonb_build_array(
                      COALESCE(NULLIF(BTRIM(rule.assignee_rule),''),'{}')::jsonb,
                      COALESCE(NULLIF(BTRIM(rule.recipient_rule),''),'{}')::jsonb,
                      COALESCE(NULLIF(BTRIM(rule.escalation_rule),''),'{}')::jsonb
                  ),
                  'strict $.**.groupId'
              ) AS reference(value)
              WHERE parse_group_reference_id(reference.value)=?
          )
        """;

    private static final List<String> REQUIRED_FUNCTIONS = List.of(
        "require_active_business_group",
        "parse_group_reference_id",
        "require_active_visible_groups",
        "require_active_ops_rule_groups",
        "enforce_active_group_scalar_reference",
        "enforce_active_shared_file_group_references",
        "enforce_active_ops_rule_group_references"
    );

    private static final Set<ForeignKeyDescriptor> REQUIRED_FOREIGN_KEYS = Set.of(
        new ForeignKeyDescriptor("daily_report", "group_id"),
        new ForeignKeyDescriptor("device", "group_id"),
        new ForeignKeyDescriptor("ops_duty_roster", "group_id"),
        new ForeignKeyDescriptor("ops_schedule_task", "group_id"),
        new ForeignKeyDescriptor("sys_user", "group_id"),
        new ForeignKeyDescriptor("sys_user_group_membership", "group_id")
    );

    private static final List<ReferenceDescriptor> DESCRIPTORS = buildDescriptors();

    private GroupReferenceRegistry() {
    }

    public static List<ReferenceDescriptor> descriptors() {
        return DESCRIPTORS;
    }

    public static List<String> requiredFunctions() {
        return REQUIRED_FUNCTIONS;
    }

    public static Set<ForeignKeyDescriptor> requiredForeignKeys() {
        return REQUIRED_FOREIGN_KEYS;
    }

    public static Map<String, TriggerDescriptor> requiredTriggers() {
        Map<String, TriggerDescriptor> triggers = new LinkedHashMap<>();
        for (ReferenceDescriptor descriptor : DESCRIPTORS) {
            if (descriptor.triggerName() == null) continue;
            TriggerDescriptor trigger = new TriggerDescriptor(
                descriptor.triggerName(), descriptor.source(), descriptor.triggerFunction());
            TriggerDescriptor previous = triggers.putIfAbsent(trigger.name(), trigger);
            if (previous != null && !previous.equals(trigger)) {
                throw new IllegalStateException("Conflicting group reference trigger descriptor: " + trigger.name());
            }
        }
        return Map.copyOf(triggers);
    }

    public static List<String> validationErrors() {
        List<String> errors = new ArrayList<>();
        Set<String> referenceTypes = new LinkedHashSet<>();
        for (ReferenceDescriptor descriptor : DESCRIPTORS) {
            if (!referenceTypes.add(descriptor.referenceType())) {
                errors.add("duplicate-reference-type:" + descriptor.referenceType());
            }
            if (descriptor.source().isBlank() || descriptor.referencePath().isBlank()
                    || descriptor.columns().isEmpty() || descriptor.tenantRule().isBlank()
                    || descriptor.purgeCountSql().isBlank() || descriptor.purgeReasonCode().isBlank()) {
                errors.add("incomplete-descriptor:" + descriptor.referenceType());
            }
            if (descriptor.archiveDisposition() == Disposition.BLOCKER
                    && (descriptor.activeCountSql() == null || descriptor.archiveReasonCode() == null)) {
                errors.add("missing-archive-contract:" + descriptor.referenceType());
            }
            if ((descriptor.triggerName() == null) != (descriptor.triggerFunction() == null)) {
                errors.add("incomplete-trigger-contract:" + descriptor.referenceType());
            }
            if (descriptor.applicationWriterSymbols().isEmpty()
                    && descriptor.validatorCoverage().isBlank()) {
                errors.add("missing-writer-coverage:" + descriptor.referenceType());
            }
        }
        if (requiredTriggers().size() != 17) {
            errors.add("trigger-denominator:" + requiredTriggers().size());
        }
        if (REQUIRED_FUNCTIONS.size() != 7) {
            errors.add("function-denominator:" + REQUIRED_FUNCTIONS.size());
        }
        return List.copyOf(errors);
    }

    private static List<ReferenceDescriptor> buildDescriptors() {
        List<ReferenceDescriptor> descriptors = new ArrayList<>();
        descriptors.add(descriptor("leaders", "sys_group", set("tenant_id", "id", "leader_id"),
            "leader_id on target group", "target group tenant_id", "leader_id IS NOT NULL",
            Disposition.BLOCKER, "GROUP_ACTIVE_LEADER", "该组仍配置组长", "先在组管理中移除或迁移组长",
            "SELECT COUNT(*) FROM sys_group WHERE tenant_id=? AND id=? AND leader_id IS NOT NULL",
            "SELECT COUNT(*) FROM sys_group WHERE tenant_id=? AND id=? AND leader_id IS NOT NULL",
            Binding.TENANT_GROUP, null, null,
            List.of("GroupController#update"), "application-service"));
        descriptors.add(scalar("primaryUsers", "sys_user", "group_id", "NOT is_deleted",
            "trg_sys_user_active_group", "GROUP_ACTIVE_PRIMARY_USERS", "该组仍是 {count} 个用户的主组",
            "先通过组管理或迁移工作台调整主组",
            List.of("UserService#create", "UserService#update", "GroupMembershipService#add",
                "GroupMembershipService#setPrimaryMembership", "GroupMembershipService#syncPrimaryMembership")));
        descriptors.add(scalar("memberships", "sys_user_group_membership", "group_id", "NOT is_deleted",
            "trg_sys_user_group_membership_active_group", "GROUP_ACTIVE_MEMBERSHIPS",
            "该组仍有 {count} 条活动成员关系", "先在组成员管理中移除或迁移成员",
            List.of("GroupMembershipService#add", "GroupMembershipService#remove",
                "GroupMembershipService#removeByGroup")));
        descriptors.add(descriptor("roleAssignments", "sys_role_assignment",
            set("tenant_id", "scope_type", "scope_id", "is_deleted"), "scope_type=group scope_id",
            "tenant_id", "scope_type='group' AND NOT is_deleted", Disposition.BLOCKER,
            "GROUP_ACTIVE_ROLE_ASSIGNMENTS", "该组仍有 {count} 条活动作用域授权",
            "先通过授权产品入口撤销 assignment",
            "SELECT COUNT(*) FROM sys_role_assignment WHERE tenant_id=? AND scope_type='group' AND scope_id=? AND NOT is_deleted",
            "SELECT COUNT(*) FROM sys_role_assignment WHERE tenant_id=? AND scope_type='group' AND scope_id=?",
            Binding.TENANT_GROUP, "trg_sys_role_assignment_active_group",
            "enforce_active_group_scalar_reference",
            List.of("RoleAssignmentService#add", "AuthorizationMigrationService#backfill",
                "AuthorizationCutoverService#backfillUserRoleAssignments"), "database-trigger+application-lock"));
        descriptors.add(scalar("openDailyReports", "daily_report", "group_id",
            "NOT is_deleted AND status IN ('DRAFT','SUBMITTED','REJECTED')",
            "trg_daily_report_active_group", "GROUP_OPEN_DAILY_REPORTS",
            "该组仍有 {count} 份可处理日报", "先完成或迁移 DRAFT、SUBMITTED、REJECTED 日报",
            List.of("DailyReportService#create")));
        descriptors.add(scalar("devices", "device", "group_id", "NOT is_deleted",
            "trg_device_active_group", "GROUP_ACTIVE_DEVICES", "该组仍关联 {count} 个活动设备",
            "先通过设备管理解除或迁移组引用", List.of("DeviceService#create", "DeviceService#update")));
        descriptors.add(scalar("deviceCredentials", "device_credential", "group_id", "NOT is_deleted",
            "trg_device_credential_active_group", "GROUP_ACTIVE_DEVICE_CREDENTIALS",
            "该组仍关联 {count} 条活动凭据", "先通过凭据管理解除或迁移组引用",
            List.of("DeviceService#addCredential")));
        descriptors.add(scalar("openOpsTasks", "ops_schedule_task", "group_id",
            "NOT is_deleted AND status IN ('pending_confirm','not_started','in_progress','overdue')",
            "trg_ops_schedule_task_active_group", "GROUP_OPEN_OPS_TASKS",
            "该组仍有 {count} 个未结束运维任务", "先完成、取消或迁移任务",
            List.of("OpsCalendarTaskService#createManual", "OpsCalendarTaskService#update",
                "OpsCalendarRuleService#generateForRule")));
        descriptors.add(scalar("currentFutureRosters", "ops_duty_roster", "group_id",
            "NOT is_deleted AND duty_date >= CURRENT_DATE", "trg_ops_duty_roster_active_group",
            "GROUP_CURRENT_FUTURE_ROSTERS", "该组仍有 {count} 条当前或未来排班",
            "先删除或迁移相关排班", List.of("OpsCalendarRosterService#create", "OpsCalendarRosterService#update")));
        descriptors.add(descriptor("enabledOpsRules", "ops_schedule_rule",
            set("tenant_id", "enabled", "is_deleted", "assignee_rule", "recipient_rule", "escalation_rule"),
            "recursive JSON path strict $.**.groupId", "tenant_id",
            "enabled AND NOT is_deleted", Disposition.BLOCKER, "GROUP_ENABLED_OPS_RULES",
            "该组仍被 {count} 条启用规则引用", "先停用或修改运维规则",
            OPS_RULE_MATCH.formatted("AND rule.enabled AND NOT rule.is_deleted"),
            OPS_RULE_MATCH.formatted(""), Binding.TENANT_GROUP,
            "trg_ops_schedule_rule_active_groups", "enforce_active_ops_rule_group_references",
            List.of("OpsCalendarRuleService#create", "OpsCalendarRuleService#update",
                "OpsCalendarRuleService#setEnabled"), "database-trigger+application-validator"));
        descriptors.add(flowable("runningWorkflowLinks", "act_ru_identitylink", set("group_id_"),
            "group_id_ token <id> or group_<id>", Disposition.BLOCKER, "GROUP_RUNNING_WORKFLOW_LINKS",
            "该组仍有 {count} 条运行中流程候选关系", "先完成流程或迁移候选组",
            "SELECT COUNT(*) FROM act_ru_identitylink WHERE group_id_ IN (?, ?)", Binding.GROUP_TOKENS,
            List.of("WorkflowService#startDailyReportApproval", "WorkflowRuntimeFacadeImpl#startBusinessProcess")));
        descriptors.add(flowable("runningWorkflowVariables", "act_ru_variable", set("name_", "text_", "text2_"),
            "name_=groupId|submitterGroupToken and text token", Disposition.BLOCKER,
            "GROUP_RUNNING_WORKFLOW_VARIABLES", "该组仍有 {count} 条运行中流程变量引用",
            "先完成流程或迁移候选组变量",
            "SELECT COUNT(*) FROM act_ru_variable WHERE name_ IN ('groupId','submitterGroupToken') AND (text_ IN (?, ?) OR text2_ IN (?, ?))",
            Binding.GROUP_TOKENS_TWICE,
            List.of("WorkflowService#startDailyReportApproval", "DailyReportWorkflowAdapter#buildStartVariables",
                "WorkflowRuntimeFacadeImpl#startBusinessProcess", "TemplateApproverResolver#startVariables")));
        descriptors.add(flowable("flowableIdentityMemberships", "act_id_membership", set("group_id_"),
            "group_id_ token <id> or group_<id>", Disposition.BLOCKER,
            "GROUP_FLOWABLE_IDENTITY_MEMBERSHIPS", "该组仍有 {count} 条 Flowable 身份成员关系",
            "先通过受控身份入口解除关系",
            "SELECT COUNT(*) FROM act_id_membership WHERE group_id_ IN (?, ?)", Binding.GROUP_TOKENS,
            List.of()));
        descriptors.add(flowable("flowablePrivilegeMappings", "act_id_priv_mapping", set("group_id_"),
            "group_id_ token <id> or group_<id>", Disposition.BLOCKER,
            "GROUP_FLOWABLE_PRIVILEGE_MAPPINGS", "该组仍有 {count} 条 Flowable 权限映射",
            "先通过受控权限入口解除映射",
            "SELECT COUNT(*) FROM act_id_priv_mapping WHERE group_id_ IN (?, ?)", Binding.GROUP_TOKENS,
            List.of()));
        descriptors.add(owner("wikiSpaceOwners", "wiki_space", "trg_wiki_space_owner_active_group",
            "GROUP_ACTIVE_WIKI_SPACE_OWNERS", "该组仍拥有 {count} 个 Wiki 空间", "先迁移 Wiki 空间 owner group",
            List.of("WikiSpaceService#createSpace", "AuthorizationResourceMigrationService#backfill",
                "AuthorizationResourceMigrationService#initializeCreatedResource")));
        descriptors.add(owner("wikiPageOwners", "wiki_page", "trg_wiki_page_owner_active_group",
            "GROUP_ACTIVE_WIKI_PAGE_OWNERS", "该组仍拥有 {count} 个 Wiki 页面", "先迁移 Wiki 页面 owner group",
            List.of("WikiPageService#createPage", "AuthorizationResourceMigrationService#backfill",
                "AuthorizationResourceMigrationService#initializeCreatedResource")));
        descriptors.add(owner("sharedFolderOwners", "shared_folder", "trg_shared_folder_owner_active_group",
            "GROUP_ACTIVE_SHARED_FOLDER_OWNERS", "该组仍拥有 {count} 个共享目录", "先迁移共享目录 owner group",
            List.of("SharedFolderService#createFolder", "SharedFolderService#getOrCreateFolder",
                "AuthorizationResourceMigrationService#backfill",
                "AuthorizationResourceMigrationService#initializeCreatedResource")));
        descriptors.add(descriptor("sharedFileOwners", "shared_file",
            set("tenant_id", "owner_group_id", "visible_groups", "is_deleted"), "owner_group_id", "tenant_id",
            "NOT is_deleted", Disposition.BLOCKER, "GROUP_ACTIVE_SHARED_FILE_OWNERS",
            "该组仍拥有 {count} 个共享文件", "先迁移共享文件 owner group",
            "SELECT COUNT(*) FROM shared_file WHERE tenant_id=? AND owner_group_id=? AND NOT is_deleted",
            "SELECT COUNT(*) FROM shared_file WHERE tenant_id=? AND owner_group_id=?", Binding.TENANT_GROUP,
            "trg_shared_file_active_groups", "enforce_active_shared_file_group_references",
            List.of("SharedFileService#uploadFileUnchecked", "SharedFileService#archiveDocPart",
                "AuthorizationResourceMigrationService#backfill",
                "AuthorizationResourceMigrationService#initializeCreatedResource"),
            "database-trigger+application-validator"));
        descriptors.add(acl("resourceAcls", "resource_acl_entry", "trg_resource_acl_entry_active_group",
            "GROUP_ACTIVE_RESOURCE_ACLS", "该组仍被 {count} 条资源 ACL 引用", "先通过资源授权入口移除 ACL",
            List.of("ResourceAccessService#replace", "AuthorizationResourceMigrationService#backfill",
                "AuthorizationResourceMigrationService#initializeCreatedResource")));
        descriptors.add(acl("wikiPageAcls", "wiki_page_acl", "trg_wiki_page_acl_active_group",
            "GROUP_ACTIVE_WIKI_PAGE_ACLS", "该组仍被 {count} 条 Wiki 页面 ACL 引用",
            "先通过 Wiki 授权入口移除 ACL", List.of("WikiAclService#setAcl",
                "AuthorizationResourceMigrationService#backfill")));
        descriptors.add(acl("wikiSpaceAcls", "wiki_space_acl", "trg_wiki_space_acl_active_group",
            "GROUP_ACTIVE_WIKI_SPACE_ACLS", "该组仍被 {count} 条 Wiki 空间 ACL 引用",
            "先通过 Wiki 授权入口移除 ACL", List.of("WikiSpaceService#createSpace", "WikiSpaceService#setAcl",
                "AuthorizationResourceMigrationService#backfill")));
        descriptors.add(acl("sharedFolderAcls", "shared_folder_acl", "trg_shared_folder_acl_active_group",
            "GROUP_ACTIVE_SHARED_FOLDER_ACLS", "该组仍被 {count} 条共享目录 ACL 引用",
            "先通过共享文件授权入口移除 ACL", List.of("SharedFolderAclService#setAcl",
                "AuthorizationResourceMigrationService#backfill")));
        descriptors.add(descriptor("sharedFileVisibleGroups", "shared_file",
            set("tenant_id", "visible_groups", "owner_group_id", "is_deleted"),
            "visible_groups JSON array number or numeric string", "tenant_id", "NOT is_deleted",
            Disposition.BLOCKER, "GROUP_ACTIVE_SHARED_FILE_VISIBLE_GROUPS",
            "该组仍被 {count} 个共享文件可见组配置引用", "先通过共享文件入口移除可见组引用",
            visibleGroupsSql("AND NOT file.is_deleted"), visibleGroupsSql(""), Binding.TENANT_GROUP,
            "trg_shared_file_active_groups", "enforce_active_shared_file_group_references",
            List.of("SharedFileService#uploadFileUnchecked"), "database-trigger+application-validator"));
        descriptors.add(flowable("workflowHistoryLinks", "act_hi_identitylink", set("group_id_"),
            "group_id_ token <id> or group_<id>", Disposition.HISTORICAL_ONLY, null, null, null,
            "SELECT COUNT(*) FROM act_hi_identitylink WHERE group_id_ IN (?, ?)", Binding.GROUP_TOKENS,
            List.of()));
        descriptors.add(flowable("workflowHistoryVariables", "act_hi_varinst", set("name_", "text_", "text2_"),
            "name_=groupId|submitterGroupToken and text token", Disposition.HISTORICAL_ONLY,
            null, null, null,
            "SELECT COUNT(*) FROM act_hi_varinst WHERE name_ IN ('groupId','submitterGroupToken') AND (text_ IN (?, ?) OR text2_ IN (?, ?))",
            Binding.GROUP_TOKENS_TWICE, List.of()));
        descriptors.add(flowable("workflowHistoryDetails", "act_hi_detail", set("name_", "text_", "text2_"),
            "name_=groupId|submitterGroupToken and text token", Disposition.HISTORICAL_ONLY,
            null, null, null,
            "SELECT COUNT(*) FROM act_hi_detail WHERE name_ IN ('groupId','submitterGroupToken') AND (text_ IN (?, ?) OR text2_ IN (?, ?))",
            Binding.GROUP_TOKENS_TWICE, List.of()));
        return List.copyOf(descriptors);
    }

    private static ReferenceDescriptor scalar(String referenceType, String table, String column,
                                                String activePredicate, String triggerName,
                                                String reasonCode, String message, String resolution,
                                                List<String> writers) {
        String qualifier = activePredicate.isBlank() ? "" : " AND " + activePredicate;
        return descriptor(referenceType, table, set("tenant_id", column, "is_deleted"), column,
            "tenant_id", activePredicate, Disposition.BLOCKER, reasonCode, message, resolution,
            "SELECT COUNT(*) FROM " + table + " WHERE tenant_id=? AND " + column + "=?" + qualifier,
            "SELECT COUNT(*) FROM " + table + " WHERE tenant_id=? AND " + column + "=?",
            Binding.TENANT_GROUP, triggerName, "enforce_active_group_scalar_reference", writers,
            "database-trigger+application-validator");
    }

    private static ReferenceDescriptor owner(String referenceType, String table, String triggerName,
                                               String reasonCode, String message, String resolution,
                                               List<String> writers) {
        return scalar(referenceType, table, "owner_group_id", "NOT is_deleted", triggerName,
            reasonCode, message, resolution, writers);
    }

    private static ReferenceDescriptor acl(String referenceType, String table, String triggerName,
                                             String reasonCode, String message, String resolution,
                                             List<String> writers) {
        return descriptor(referenceType, table,
            set("tenant_id", "subject_type", "subject_id", "is_deleted"),
            "subject_type=group subject_id", "tenant_id", "subject_type='group' AND NOT is_deleted",
            Disposition.BLOCKER, reasonCode, message, resolution,
            "SELECT COUNT(*) FROM " + table + " WHERE tenant_id=? AND subject_type='group' AND subject_id=? AND NOT is_deleted",
            "SELECT COUNT(*) FROM " + table + " WHERE tenant_id=? AND subject_type='group' AND subject_id=?",
            Binding.TENANT_GROUP, triggerName, "enforce_active_group_scalar_reference", writers,
            "database-trigger+application-validator");
    }

    private static ReferenceDescriptor flowable(String referenceType, String table, Set<String> columns,
                                                  String path, Disposition archiveDisposition,
                                                  String reasonCode, String message, String resolution,
                                                  String sql, Binding binding, List<String> writers) {
        return descriptor(referenceType, table, columns, path, "global numeric group id token",
            archiveDisposition == Disposition.BLOCKER ? "runtime/configuration row" : "history row",
            archiveDisposition, reasonCode, message, resolution,
            archiveDisposition == Disposition.BLOCKER ? sql : null, sql, binding, null, null, writers,
            writers.isEmpty() ? "flowable-owned-no-application-writer" : "ActiveGroupReferenceValidator");
    }

    private static ReferenceDescriptor descriptor(String referenceType, String source, Set<String> columns,
                                                    String referencePath, String tenantRule,
                                                    String activePredicate, Disposition archiveDisposition,
                                                    String archiveReasonCode, String messageTemplate,
                                                    String resolution, String activeCountSql,
                                                    String purgeCountSql, Binding binding, String triggerName,
                                                    String triggerFunction, List<String> writers,
                                                    String validatorCoverage) {
        return new ReferenceDescriptor(referenceType, source, columns, referencePath, tenantRule,
            activePredicate, archiveDisposition, Disposition.BLOCKER, List.copyOf(writers), triggerName,
            triggerFunction, validatorCoverage, archiveReasonCode,
            "GROUP_PURGE_REFERENCE_" + camelToUpperSnake(referenceType), messageTemplate, resolution,
            activeCountSql, purgeCountSql, binding);
    }

    private static String visibleGroupsSql(String activeClause) {
        return """
            SELECT COUNT(*) FROM shared_file file
            WHERE file.tenant_id=? %s
              AND EXISTS (
                  SELECT 1 FROM jsonb_array_elements(COALESCE(file.visible_groups, '[]'::jsonb)) value
                  WHERE parse_group_reference_id(value)=?
              )
            """.formatted(activeClause);
    }

    private static Set<String> set(String... values) {
        return Set.of(values);
    }

    private static String camelToUpperSnake(String value) {
        return value.replaceAll("([a-z0-9])([A-Z])", "$1_$2").toUpperCase();
    }

    public enum Disposition {
        BLOCKER,
        HISTORICAL_ONLY
    }

    public enum Binding {
        TENANT_GROUP,
        GROUP_TOKENS,
        GROUP_TOKENS_TWICE
    }

    public record ReferenceDescriptor(
        String referenceType,
        String source,
        Set<String> columns,
        String referencePath,
        String tenantRule,
        String activePredicate,
        Disposition archiveDisposition,
        Disposition purgeDisposition,
        List<String> applicationWriterSymbols,
        String triggerName,
        String triggerFunction,
        String validatorCoverage,
        String archiveReasonCode,
        String purgeReasonCode,
        String messageTemplate,
        String resolution,
        String activeCountSql,
        String purgeCountSql,
        Binding binding
    ) {
    }

    public record TriggerDescriptor(String name, String table, String function) {
    }

    public record ForeignKeyDescriptor(String table, String column) {
    }
}
