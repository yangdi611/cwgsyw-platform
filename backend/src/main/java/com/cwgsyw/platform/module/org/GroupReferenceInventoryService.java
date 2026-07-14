package com.cwgsyw.platform.module.org;

import com.cwgsyw.platform.module.org.GroupReferenceRegistry.Binding;
import com.cwgsyw.platform.module.org.GroupReferenceRegistry.Disposition;
import com.cwgsyw.platform.module.org.GroupReferenceRegistry.ForeignKeyDescriptor;
import com.cwgsyw.platform.module.org.GroupReferenceRegistry.ReferenceDescriptor;
import com.cwgsyw.platform.module.org.GroupReferenceRegistry.TriggerDescriptor;
import com.cwgsyw.platform.module.org.dto.GroupLifecycleBlocker;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class GroupReferenceInventoryService {
    private static final String DRIFT_KEY = "inventoryDrift";
    private static final String DRIFT_REASON = "GROUP_REFERENCE_INVENTORY_DRIFT";

    private final JdbcTemplate jdbcTemplate;

    public ReferenceSnapshot snapshotForArchive(String tenantId, Long groupId) {
        InventoryAudit audit = auditInventory();
        if (!audit.clean()) return driftSnapshot(audit);
        try {
            Map<String, Long> active = counts(tenantId, groupId, false);
            Map<String, Long> historical = historicalCounts(tenantId, groupId, active);
            return new ReferenceSnapshot(active, historical, blockers(active, false));
        } catch (RuntimeException exception) {
            return driftSnapshot(InventoryAudit.failure("reference-count-query-failed"));
        }
    }

    public ReferenceSnapshot snapshotForPurge(String tenantId, Long groupId) {
        InventoryAudit audit = auditInventory();
        if (!audit.clean()) return driftSnapshot(audit);
        try {
            Map<String, Long> active = counts(tenantId, groupId, false);
            Map<String, Long> allReferences = counts(tenantId, groupId, true);
            return new ReferenceSnapshot(active, allReferences, blockers(allReferences, true));
        } catch (RuntimeException exception) {
            return driftSnapshot(InventoryAudit.failure("reference-count-query-failed"));
        }
    }

    public InventoryAudit auditInventory() {
        try {
            Set<String> errors = new LinkedHashSet<>(GroupReferenceRegistry.validationErrors());
            Set<ForeignKeyDescriptor> actualForeignKeys = foreignKeys();
            if (!actualForeignKeys.equals(GroupReferenceRegistry.requiredForeignKeys())) {
                errors.add("foreign-key-denominator-mismatch");
            }

            Map<String, Set<String>> actualColumns = columnsByTable();
            for (ReferenceDescriptor descriptor : GroupReferenceRegistry.descriptors()) {
                Set<String> tableColumns = actualColumns.get(descriptor.source());
                if (tableColumns == null) {
                    errors.add("missing-source:" + descriptor.source());
                } else if (!tableColumns.containsAll(descriptor.columns())) {
                    errors.add("missing-columns:" + descriptor.source() + ":"
                        + difference(descriptor.columns(), tableColumns));
                }
            }

            Map<String, TriggerDescriptor> actualTriggers = triggers();
            if (!actualTriggers.equals(GroupReferenceRegistry.requiredTriggers())) {
                errors.add("trigger-denominator-mismatch");
            }

            Set<String> actualFunctions = Set.copyOf(jdbcTemplate.queryForList("""
                SELECT proname
                FROM pg_proc
                JOIN pg_namespace namespace ON namespace.oid=pg_proc.pronamespace
                WHERE namespace.nspname='public'
                """, String.class));
            if (!actualFunctions.containsAll(GroupReferenceRegistry.requiredFunctions())) {
                errors.add("missing-functions:"
                    + difference(Set.copyOf(GroupReferenceRegistry.requiredFunctions()), actualFunctions));
            }
            return new InventoryAudit(GroupReferenceRegistry.VERSION, errors.isEmpty(), List.copyOf(errors));
        } catch (RuntimeException exception) {
            return InventoryAudit.failure("catalog-audit-query-failed");
        }
    }

    private Map<String, Long> counts(String tenantId, Long groupId, boolean purge) {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (ReferenceDescriptor descriptor : GroupReferenceRegistry.descriptors()) {
            if (!purge && descriptor.archiveDisposition() != Disposition.BLOCKER) continue;
            String sql = purge ? descriptor.purgeCountSql() : descriptor.activeCountSql();
            if (sql == null || counts.put(descriptor.referenceType(), count(descriptor, sql, tenantId, groupId)) != null) {
                throw new IllegalStateException("Invalid group reference count descriptor: "
                    + descriptor.referenceType());
            }
        }
        return counts;
    }

    private Map<String, Long> historicalCounts(String tenantId, Long groupId,
                                                Map<String, Long> activeCounts) {
        Map<String, Long> historical = new LinkedHashMap<>();
        for (ReferenceDescriptor descriptor : GroupReferenceRegistry.descriptors()) {
            long total = count(descriptor, descriptor.purgeCountSql(), tenantId, groupId);
            long active = activeCounts.getOrDefault(descriptor.referenceType(), 0L);
            long historicalCount = descriptor.archiveDisposition() == Disposition.HISTORICAL_ONLY
                ? total : Math.max(0, total - active);
            if (historicalCount > 0) historical.put(descriptor.referenceType(), historicalCount);
        }
        return historical;
    }

    private long count(ReferenceDescriptor descriptor, String sql, String tenantId, Long groupId) {
        Object[] arguments = switch (descriptor.binding()) {
            case TENANT_GROUP -> new Object[]{tenantId, groupId};
            case GROUP_TOKENS -> new Object[]{String.valueOf(groupId), "group_" + groupId};
            case GROUP_TOKENS_TWICE -> new Object[]{
                String.valueOf(groupId), "group_" + groupId,
                String.valueOf(groupId), "group_" + groupId
            };
        };
        Long value = jdbcTemplate.queryForObject(sql, Long.class, arguments);
        if (value == null || value < 0) {
            throw new IllegalStateException("Invalid group reference count: " + descriptor.referenceType());
        }
        return value;
    }

    private List<GroupLifecycleBlocker> blockers(Map<String, Long> counts, boolean purge) {
        List<GroupLifecycleBlocker> result = new ArrayList<>();
        Map<String, ReferenceDescriptor> descriptors = new LinkedHashMap<>();
        GroupReferenceRegistry.descriptors().forEach(
            descriptor -> descriptors.put(descriptor.referenceType(), descriptor));
        counts.forEach((referenceType, value) -> {
            if (value == null) throw new IllegalStateException("Null group reference count: " + referenceType);
            if (value == 0) return;
            ReferenceDescriptor descriptor = descriptors.get(referenceType);
            if (descriptor == null) {
                throw new IllegalStateException("Unknown group reference type: " + referenceType);
            }
            String reasonCode = purge ? descriptor.purgeReasonCode() : descriptor.archiveReasonCode();
            String message = purge
                ? "该用户组仍有 " + value + " 条 " + referenceType + " 引用"
                : descriptor.messageTemplate().replace("{count}", String.valueOf(value));
            String resolution = purge
                ? "保留历史记录并取消清除，或通过产品能力解除全部引用"
                : descriptor.resolution();
            result.add(new GroupLifecycleBlocker(reasonCode, referenceType, value, message, resolution));
        });
        return List.copyOf(result);
    }

    private ReferenceSnapshot driftSnapshot(InventoryAudit audit) {
        long driftCount = Math.max(1, audit.errors().size());
        Map<String, Long> active = Map.of(DRIFT_KEY, driftCount);
        GroupLifecycleBlocker blocker = new GroupLifecycleBlocker(
            DRIFT_REASON, DRIFT_KEY, driftCount,
            "用户组引用清单与当前数据库结构不一致",
            "先更新引用 registry、迁移、writer coverage 和验证分母");
        return new ReferenceSnapshot(active, Map.of(), List.of(blocker));
    }

    private Set<ForeignKeyDescriptor> foreignKeys() {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
            SELECT source.relname AS table_name, attribute.attname AS column_name
            FROM pg_constraint constraint_definition
            JOIN pg_class source ON source.oid=constraint_definition.conrelid
            JOIN LATERAL unnest(constraint_definition.conkey) key(attnum) ON TRUE
            JOIN pg_attribute attribute
              ON attribute.attrelid=constraint_definition.conrelid
             AND attribute.attnum=key.attnum
            WHERE constraint_definition.contype='f'
              AND constraint_definition.confrelid='sys_group'::regclass
            """);
        Set<ForeignKeyDescriptor> result = new LinkedHashSet<>();
        for (Map<String, Object> row : rows) {
            result.add(new ForeignKeyDescriptor(
                String.valueOf(row.get("table_name")), String.valueOf(row.get("column_name"))));
        }
        return Set.copyOf(result);
    }

    private Map<String, Set<String>> columnsByTable() {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_schema='public'
            """);
        Map<String, Set<String>> result = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            result.computeIfAbsent(String.valueOf(row.get("table_name")), ignored -> new LinkedHashSet<>())
                .add(String.valueOf(row.get("column_name")));
        }
        return result;
    }

    private Map<String, TriggerDescriptor> triggers() {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
            SELECT trigger.tgname AS trigger_name,
                   source.relname AS table_name,
                   function.proname AS function_name
            FROM pg_trigger trigger
            JOIN pg_class source ON source.oid=trigger.tgrelid
            JOIN pg_proc function ON function.oid=trigger.tgfoid
            WHERE NOT trigger.tgisinternal
              AND trigger.tgname LIKE 'trg_%_active_group%'
            """);
        Map<String, TriggerDescriptor> result = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            TriggerDescriptor descriptor = new TriggerDescriptor(
                String.valueOf(row.get("trigger_name")),
                String.valueOf(row.get("table_name")),
                String.valueOf(row.get("function_name")));
            if (result.put(descriptor.name(), descriptor) != null) {
                throw new IllegalStateException("Duplicate group reference trigger: " + descriptor.name());
            }
        }
        return Map.copyOf(result);
    }

    private static Set<String> difference(Set<String> expected, Set<String> actual) {
        Set<String> missing = new LinkedHashSet<>(expected);
        missing.removeAll(actual);
        return missing;
    }

    public record ReferenceSnapshot(
        Map<String, Long> activeCounts,
        Map<String, Long> historicalCounts,
        List<GroupLifecycleBlocker> blockers
    ) {
    }

    public record InventoryAudit(String registryVersion, boolean clean, List<String> errors) {
        private static InventoryAudit failure(String error) {
            return new InventoryAudit(GroupReferenceRegistry.VERSION, false, List.of(error));
        }
    }
}
