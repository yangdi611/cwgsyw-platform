package com.cwgsyw.platform.module.cmdb.spatial;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertEquals;

/** PostgreSQL contract checks for V110; existing CMDB tables are only seeded, never altered by this test. */
@Testcontainers
class SpatialLayoutMigrationIntegrationTest {
    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
            .withDatabaseName("spatial_layout")
            .withUsername("spatial")
            .withPassword("spatial");

    private static JdbcTemplate jdbc;
    private static long roomId;
    private static long rackId;
    private static long layoutId;
    private static long draftId;

    @BeforeAll
    static void migrateAndSeedCmdbFacts() {
        var dataSource = new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        jdbc = new JdbcTemplate(dataSource);
        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").validateOnMigrate(true).load().migrate();
        roomId = jdbc.queryForObject("""
            INSERT INTO ci_instance (tenant_id, model_id, name, status, attrs, is_deleted)
            VALUES ('spatial-test', 'idc_room', '308机房', 'online', '{}'::jsonb, FALSE) RETURNING id
            """, Long.class);
        rackId = jdbc.queryForObject("""
            INSERT INTO ci_instance (tenant_id, model_id, name, status, attrs, is_deleted)
            VALUES ('spatial-test', 'rack', 'F-01机柜', 'online', '{"rack_height_u":42}'::jsonb, FALSE) RETURNING id
            """, Long.class);
        jdbc.update("""
            INSERT INTO ci_instance_rel (tenant_id, src_id, dst_id, def_id, metadata, is_deleted)
            VALUES ('spatial-test', ?, ?, 'room_contains_rack', '{}'::jsonb, FALSE)
            """, roomId, rackId);
        layoutId = jdbc.queryForObject("""
            INSERT INTO ci_spatial_layout (tenant_id, room_instance_id, name, status, is_deleted)
            VALUES ('spatial-test', ?, '308布局', 'ACTIVE', FALSE) RETURNING id
            """, Long.class, roomId);
        draftId = jdbc.queryForObject("""
            INSERT INTO ci_spatial_layout_version
              (tenant_id, layout_id, state, revision, schema_version, document_json, document_checksum, element_count, created_by, updated_by)
            VALUES ('spatial-test', ?, 'DRAFT', 0, 1, '{"schemaVersion":1,"canvas":{"logicalWidth":1600,"logicalHeight":1000},"elements":[]}'::jsonb, repeat('0',64), 0, 1, 1)
            RETURNING id
            """, Long.class, layoutId);
        jdbc.update("UPDATE ci_spatial_layout SET draft_version_id = ? WHERE id = ?", draftId, layoutId);
    }

    @Test
    void rejectsSecondActiveLayoutButAllowsArchivedHistoryForTheSameRoom() {
        assertThatThrownBy(() -> jdbc.update("""
            INSERT INTO ci_spatial_layout (tenant_id, room_instance_id, name, status, is_deleted)
            VALUES ('spatial-test', ?, '重复布局', 'ACTIVE', FALSE)
            """, roomId)).isInstanceOf(DataIntegrityViolationException.class);
        jdbc.update("UPDATE ci_spatial_layout SET status = 'ARCHIVED' WHERE id = ?", layoutId);
        assertEquals(1, jdbc.update("""
            INSERT INTO ci_spatial_layout (tenant_id, room_instance_id, name, status, is_deleted)
            VALUES ('spatial-test', ?, '308替代布局', 'ACTIVE', FALSE)
            """, roomId));
        assertThatThrownBy(() -> jdbc.update("""
            INSERT INTO ci_spatial_layout_version
              (tenant_id, layout_id, state, revision, schema_version, document_json, document_checksum, element_count, created_by, updated_by)
            VALUES ('spatial-test', ?, 'DRAFT', 0, 1, '{}'::jsonb, repeat('0',64), 0, 1, 1)
            """, layoutId)).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void rejectsDuplicateBindingAndProtectsReferencedAsset() {
        long publishedId = jdbc.queryForObject("""
            INSERT INTO ci_spatial_layout_version
              (tenant_id, layout_id, state, version_no, revision, schema_version, document_json, document_checksum, element_count,
               published_at, published_by, created_by, updated_by)
            VALUES ('spatial-test', ?, 'PUBLISHED', 1, 0, 1, '{}'::jsonb, repeat('1',64), 1, NOW(), 1, 1, 1)
            RETURNING id
            """, Long.class, layoutId);
        jdbc.update("UPDATE ci_spatial_layout SET published_version_id = ? WHERE id = ?", publishedId, layoutId);
        jdbc.update("""
            INSERT INTO ci_spatial_binding
              (tenant_id, layout_id, layout_version_id, room_instance_id, element_id, element_type, ci_instance_id,
               ci_model_id_snapshot, display_name_snapshot, created_by)
            VALUES ('spatial-test', ?, ?, ?, '00000000-0000-0000-0000-000000000001', 'RACK_SLOT', ?, 'rack', 'F-01机柜', 1)
            """, layoutId, publishedId, roomId, rackId);
        assertThatThrownBy(() -> jdbc.update("""
            INSERT INTO ci_spatial_binding
              (tenant_id, layout_id, layout_version_id, room_instance_id, element_id, element_type, ci_instance_id,
               ci_model_id_snapshot, display_name_snapshot, created_by)
            VALUES ('spatial-test', ?, ?, ?, '00000000-0000-0000-0000-000000000002', 'RACK_SLOT', ?, 'rack', 'F-01机柜', 1)
            """, layoutId, publishedId, roomId, rackId)).isInstanceOf(DataIntegrityViolationException.class);

        long assetId = jdbc.queryForObject("""
            INSERT INTO ci_spatial_asset
              (tenant_id, layout_id, asset_type, object_key, original_name, content_type, byte_size, sha256, pixel_width, pixel_height, is_deleted)
            VALUES ('spatial-test', ?, 'REFERENCE_IMAGE', 'cmdb-spatial/test/asset', 'room.png', 'image/png', 1, repeat('a',64), 1, 1, FALSE)
            RETURNING id
            """, Long.class, layoutId);
        jdbc.update("""
            INSERT INTO ci_spatial_version_asset (tenant_id, layout_version_id, asset_id, usage, created_by)
            VALUES ('spatial-test', ?, ?, 'REFERENCE_BACKGROUND', 1)
            """, publishedId, assetId);
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM ci_spatial_version_asset WHERE asset_id = ?", Integer.class, assetId));
        assertThatThrownBy(() -> jdbc.update("DELETE FROM ci_spatial_asset WHERE id = ?", assetId))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
