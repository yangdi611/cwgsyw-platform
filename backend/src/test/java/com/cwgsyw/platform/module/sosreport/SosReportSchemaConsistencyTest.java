package com.cwgsyw.platform.module.sosreport;

import com.baomidou.mybatisplus.core.metadata.TableFieldInfo;
import com.baomidou.mybatisplus.core.metadata.TableInfo;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.cwgsyw.platform.module.sosreport.entity.SosCmdbRequest;
import com.cwgsyw.platform.module.sosreport.entity.SosFieldMapping;
import com.cwgsyw.platform.module.sosreport.entity.SosReport;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 在没有数据库的单元测试里，校验实体和迁移脚本没有分歧。
 * 真实数据库上的执行由 {@code UnifiedTaskFreshInstallMigrationTest} 覆盖。
 */
class SosReportSchemaConsistencyTest {

    private static String migration;

    @BeforeAll
    static void load() throws IOException {
        SosTestSupport.initTables();
        migration = new ClassPathResource("db/migration/V112__sos_report.sql").getContentAsString(StandardCharsets.UTF_8);
    }

    private static Set<String> tableColumns(String table) {
        Matcher block = Pattern.compile("CREATE TABLE " + table + " \\((.*?)\\n\\);", Pattern.DOTALL).matcher(migration);
        assertTrue(block.find(), table);
        Set<String> columns = block.group(1).lines()
            .map(String::trim)
            .filter(line -> !line.isEmpty() && !line.startsWith("--") && !line.startsWith("CONSTRAINT") && !line.startsWith("CHECK"))
            .map(line -> line.split("\\s+")[0].toLowerCase(Locale.ROOT))
            .collect(Collectors.toSet());
        assertFalse(columns.isEmpty(), table);
        return columns;
    }

    private static void assertEntityMatchesTable(Class<?> entity, String table) {
        TableInfo info = TableInfoHelper.getTableInfo(entity);
        assertEquals(table, info.getTableName());
        Set<String> columns = tableColumns(table);
        assertTrue(columns.contains(info.getKeyColumn()), table + "." + info.getKeyColumn());
        for (TableFieldInfo field : info.getFieldList()) {
            assertTrue(columns.contains(field.getColumn()), table + " 缺少列 " + field.getColumn());
        }
    }

    @Test
    void reportEntityMatchesMigration() {
        assertEntityMatchesTable(SosReport.class, "sos_report");
    }

    @Test
    void mappingEntityMatchesMigration() {
        assertEntityMatchesTable(SosFieldMapping.class, "sos_field_mapping");
    }

    @Test
    void requestEntityMatchesMigration() {
        assertEntityMatchesTable(SosCmdbRequest.class, "sos_cmdb_request");
    }

    @Test
    void statusConstantsAreAllowedByCheckConstraints() {
        for (String status : List.of(SosReport.STATUS_PENDING, SosReport.STATUS_PARSING, SosReport.STATUS_PARSED, SosReport.STATUS_FAILED,
            SosFieldMapping.STATUS_SUGGESTED, SosFieldMapping.STATUS_CONFIRMED, SosFieldMapping.STATUS_UNMAPPABLE,
            SosFieldMapping.SOURCE_MANUAL, SosFieldMapping.SOURCE_AI,
            SosCmdbRequest.STATUS_PENDING, SosCmdbRequest.STATUS_APPLIED, SosCmdbRequest.STATUS_REJECTED, SosCmdbRequest.STATUS_APPLY_FAILED,
            SosCmdbRequest.ACTION_CREATE, SosCmdbRequest.ACTION_UPDATE)) {
            assertTrue(migration.contains("'" + status + "'"), status);
        }
    }

    @Test
    void migrationSeedsEveryPermissionUsedByTheController() {
        for (String action : List.of("read", "upload", "delete", "submit", "approve", "manage_mapping")) {
            assertTrue(migration.contains("\"" + action + "\""), action);
        }
        assertTrue(migration.contains("WHERE role.code IN ('super_admin', 'admin')"));
    }

    @Test
    void migrationOnlyAddsObjects() {
        String upper = migration.toUpperCase(Locale.ROOT);
        for (String forbidden : List.of("DROP ", "ALTER TABLE", "TRUNCATE", "DELETE FROM")) {
            assertFalse(upper.contains(forbidden), forbidden);
        }
    }
}
