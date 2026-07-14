package com.cwgsyw.platform.module.org;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Testcontainers
class GroupReferenceInventoryIntegrationTest {
    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
        .withDatabaseName("cwgsyw_group_inventory_it")
        .withUsername("fqa")
        .withPassword("fqa");

    private static JdbcTemplate jdbcTemplate;
    private static GroupReferenceInventoryService inventoryService;

    @BeforeAll
    static void prepareSchema() {
        Flyway.configure()
            .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
            .validateOnMigrate(false)
            .load()
            .migrate();
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
            POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        jdbcTemplate = new JdbcTemplate(dataSource);
        createFlowableInventorySources();
        inventoryService = new GroupReferenceInventoryService(jdbcTemplate);
    }

    @Test
    void realCatalogMatchesVersionedRegistry() {
        GroupReferenceInventoryService.InventoryAudit audit = inventoryService.auditInventory();

        assertTrue(audit.clean(), audit.errors().toString());
        assertEquals(GroupReferenceRegistry.VERSION, audit.registryVersion());
        assertTrue(audit.errors().isEmpty());
    }

    @Test
    void recursiveOpsRulesAndFlowableVariablesAreCounted() {
        String tenantId = "registry_" + System.nanoTime();
        Long groupId = jdbcTemplate.queryForObject("""
            INSERT INTO sys_group (tenant_id, code, name, group_type, is_builtin)
            VALUES (?, ?, 'Registry Group', 'business', FALSE)
            RETURNING id
            """, Long.class, tenantId, "registry_" + System.nanoTime());
        jdbcTemplate.update("""
            INSERT INTO ops_schedule_rule
                (tenant_id, name, task_type, trigger_type, assignee_rule, recipient_rule, escalation_rule)
            VALUES (?, 'recursive', 'inspection', 'daily', '{}', ?, ?)
            """, tenantId,
            "{\"nested\":{\"groupId\":\"" + groupId + "\"}}",
            "{\"targets\":[{\"groupId\":" + groupId + "}]}");
        jdbcTemplate.update("""
            INSERT INTO act_ru_variable (name_, text_, text2_)
            VALUES ('submitterGroupToken', ?, NULL)
            """, "group_" + groupId);
        jdbcTemplate.update("""
            INSERT INTO act_hi_detail (name_, text_, text2_)
            VALUES ('groupId', ?, NULL)
            """, String.valueOf(groupId));

        GroupReferenceInventoryService.ReferenceSnapshot archive =
            inventoryService.snapshotForArchive(tenantId, groupId);
        GroupReferenceInventoryService.ReferenceSnapshot purge =
            inventoryService.snapshotForPurge(tenantId, groupId);

        assertEquals(1L, archive.activeCounts().get("enabledOpsRules"));
        assertEquals(1L, archive.activeCounts().get("runningWorkflowVariables"));
        assertEquals(1L, purge.historicalCounts().get("workflowHistoryDetails"));
        assertTrue(archive.blockers().stream()
            .anyMatch(blocker -> "GROUP_ENABLED_OPS_RULES".equals(blocker.reasonCode())));
        assertFalse(purge.blockers().isEmpty());
    }

    private static void createFlowableInventorySources() {
        Map<String, String> tables = Map.of(
            "act_ru_identitylink", "group_id_ VARCHAR(255)",
            "act_hi_identitylink", "group_id_ VARCHAR(255)",
            "act_id_membership", "group_id_ VARCHAR(255)",
            "act_id_priv_mapping", "group_id_ VARCHAR(255)",
            "act_ru_variable", "name_ VARCHAR(255), text_ VARCHAR(4000), text2_ VARCHAR(4000)",
            "act_hi_varinst", "name_ VARCHAR(255), text_ VARCHAR(4000), text2_ VARCHAR(4000)",
            "act_hi_detail", "name_ VARCHAR(255), text_ VARCHAR(4000), text2_ VARCHAR(4000)"
        );
        tables.forEach((table, columns) ->
            jdbcTemplate.execute("CREATE TABLE " + table + " (" + columns + ")"));
    }
}
