package com.cwgsyw.platform.module.org;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class GroupReferenceInventoryServiceTest {

    @Test
    void catalogFailureFailsClosedForArchive() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForList(anyString())).thenThrow(new IllegalStateException("catalog unavailable"));
        GroupReferenceInventoryService service = new GroupReferenceInventoryService(jdbcTemplate);

        GroupReferenceInventoryService.ReferenceSnapshot snapshot =
            service.snapshotForArchive("default", 11L);

        assertEquals(Map.of("inventoryDrift", 1L), snapshot.activeCounts());
        assertEquals("GROUP_REFERENCE_INVENTORY_DRIFT", snapshot.blockers().getFirst().reasonCode());
    }

    @Test
    void catalogMismatchFailsClosedForPurge() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForList(anyString())).thenReturn(List.of());
        GroupReferenceInventoryService service = new GroupReferenceInventoryService(jdbcTemplate);

        GroupReferenceInventoryService.ReferenceSnapshot snapshot =
            service.snapshotForPurge("default", 11L);

        assertFalse(snapshot.blockers().isEmpty());
        assertEquals("GROUP_REFERENCE_INVENTORY_DRIFT", snapshot.blockers().getFirst().reasonCode());
    }

    @Test
    void countFailureAfterCleanCatalogFailsClosed() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        GroupReferenceInventoryService service = new GroupReferenceInventoryService(jdbcTemplate);
        when(jdbcTemplate.queryForList(anyString()))
            .thenAnswer(invocation -> catalogResult(invocation.getArgument(0, String.class)));
        when(jdbcTemplate.queryForList(anyString(), eq(String.class)))
            .thenReturn(GroupReferenceRegistry.requiredFunctions());
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), any(Object[].class)))
            .thenThrow(new IllegalStateException("count unavailable"));

        GroupReferenceInventoryService.ReferenceSnapshot snapshot =
            service.snapshotForArchive("default", 11L);

        assertEquals(Map.of("inventoryDrift", 1L), snapshot.activeCounts());
        assertEquals("GROUP_REFERENCE_INVENTORY_DRIFT", snapshot.blockers().getFirst().reasonCode());
    }

    private static List<Map<String, Object>> catalogResult(String sql) {
        if (sql.contains("pg_constraint")) {
            return GroupReferenceRegistry.requiredForeignKeys().stream()
                .map(foreignKey -> Map.<String, Object>of(
                    "table_name", foreignKey.table(), "column_name", foreignKey.column()))
                .toList();
        }
        if (sql.contains("information_schema.columns")) {
            return GroupReferenceRegistry.descriptors().stream()
                .flatMap(descriptor -> descriptor.columns().stream()
                    .map(column -> Map.<String, Object>of(
                        "table_name", descriptor.source(), "column_name", column)))
                .distinct()
                .toList();
        }
        if (sql.contains("pg_trigger")) {
            return GroupReferenceRegistry.requiredTriggers().values().stream()
                .map(trigger -> Map.<String, Object>of(
                    "trigger_name", trigger.name(), "table_name", trigger.table(),
                    "function_name", trigger.function()))
                .toList();
        }
        throw new IllegalStateException("Unexpected catalog SQL: " + sql);
    }
}
