package com.cwgsyw.platform.module.cmdb.spatial;

import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.config.GlobalConfig;
import com.baomidou.mybatisplus.extension.spring.MybatisSqlSessionFactoryBean;
import com.cwgsyw.platform.config.MyBatisPlusConfig;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.cmdb.spatial.document.SpatialDocumentValidator;
import com.cwgsyw.platform.module.cmdb.spatial.dto.SpatialCreateLayoutRequest;
import com.cwgsyw.platform.module.cmdb.spatial.dto.SpatialPublishRequest;
import com.cwgsyw.platform.module.cmdb.spatial.dto.SpatialSaveDraftRequest;
import com.cwgsyw.platform.module.cmdb.spatial.entity.SpatialLayout;
import com.cwgsyw.platform.module.cmdb.spatial.mapper.SpatialAssetMapper;
import com.cwgsyw.platform.module.cmdb.spatial.mapper.SpatialBindingMapper;
import com.cwgsyw.platform.module.cmdb.spatial.mapper.SpatialCmdbReadMapper;
import com.cwgsyw.platform.module.cmdb.spatial.mapper.SpatialLayoutMapper;
import com.cwgsyw.platform.module.cmdb.spatial.mapper.SpatialLayoutVersionMapper;
import com.cwgsyw.platform.module.cmdb.spatial.mapper.SpatialRuntimeMapper;
import com.cwgsyw.platform.module.cmdb.spatial.mapper.SpatialVersionAssetMapper;
import com.cwgsyw.platform.module.cmdb.spatial.service.SpatialLayoutService;
import com.cwgsyw.platform.module.cmdb.spatial.service.SpatialRuntimeService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactory;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Exercises lifecycle and runtime SQL against PostgreSQL, rather than mock mapper behavior. */
@Testcontainers
class SpatialLayoutLifecycleIntegrationTest {
    private static final String TENANT = "spatial-lifecycle";
    private static final String OTHER_TENANT = "spatial-lifecycle-other";
    private static final ObjectMapper JSON = new ObjectMapper();

    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
            .withDatabaseName("spatial_lifecycle")
            .withUsername("spatial")
            .withPassword("spatial");

    private static SqlSessionFactory sessions;
    private static JdbcTemplate jdbc;

    @BeforeAll
    static void prepareDatabase() throws Exception {
        String url = POSTGRES.getJdbcUrl() + "&stringtype=unspecified";
        Flyway.configure().dataSource(url, POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("classpath:db/migration").load().migrate();
        DriverManagerDataSource source = new DriverManagerDataSource(url, POSTGRES.getUsername(), POSTGRES.getPassword());
        jdbc = new JdbcTemplate(source);
        MybatisConfiguration configuration = new MybatisConfiguration();
        configuration.setMapUnderscoreToCamelCase(true);
        configuration.addMapper(AuditLogMapper.class);
        configuration.addMapper(SpatialLayoutMapper.class);
        configuration.addMapper(SpatialLayoutVersionMapper.class);
        configuration.addMapper(SpatialBindingMapper.class);
        configuration.addMapper(SpatialAssetMapper.class);
        configuration.addMapper(SpatialVersionAssetMapper.class);
        configuration.addMapper(SpatialCmdbReadMapper.class);
        configuration.addMapper(SpatialRuntimeMapper.class);
        MybatisSqlSessionFactoryBean factory = new MybatisSqlSessionFactoryBean();
        factory.setDataSource(source);
        factory.setConfiguration(configuration);
        factory.setGlobalConfig(new GlobalConfig().setDbConfig(new GlobalConfig.DbConfig()
                .setLogicDeleteField("isDeleted")
                .setLogicDeleteValue("true")
                .setLogicNotDeleteValue("false"))
                .setMetaObjectHandler(new MyBatisPlusConfig().metaObjectHandler()));
        sessions = factory.getObject();

    }

    @Test
    void lifecycleKeepsPublishedSnapshotAndRebuildsBindingsForNextDraft() throws Exception {
        try (SqlSession session = sessions.openSession(true)) {
            SpatialLayoutService service = service(session);
            long roomId = insertCi("idc_room", "308机房", "{}");
            long rackId = insertCi("rack", "F-01机柜", "{\"rack_height_u\":42}");
            link(roomId, rackId, "room_contains_rack");
            SpatialCreateLayoutRequest create = new SpatialCreateLayoutRequest();
            create.setRoomInstanceId(roomId);
            create.setName("308机房布局");
            long layoutId = service.create(create, TENANT, 1L).layoutId();
            var initial = service.getDraft(layoutId, TENANT);

            JsonNode document = validDocument(rackId);
            var saved = service.saveDraft(layoutId, save(initial.revision(), document), TENANT, 1L);
            assertThat(saved.revision()).isEqualTo(1);
            assertThat(bindingCount(saved.versionId())).isEqualTo(1);

            assertThatThrownBy(() -> service.saveDraft(layoutId, save(0, document), TENANT, 1L))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("重新加载");

            var published = service.publish(layoutId, publish(saved.revision()), TENANT, 1L);
            assertThat(published.state()).isEqualTo("PUBLISHED");
            assertThat(published.versionNo()).isEqualTo(1);
            assertThat(bindingCount(published.versionId())).isEqualTo(1);
            var nextDraft = service.getDraft(layoutId, TENANT);
            assertThat(nextDraft.versionId()).isNotEqualTo(published.versionId());
            assertThat(nextDraft.revision()).isZero();
            assertThat(bindingCount(nextDraft.versionId())).isEqualTo(1);

            JsonNode changed = document.deepCopy();
            ((com.fasterxml.jackson.databind.node.ObjectNode) changed.path("elements").get(1)).put("name", "F-01-已调整");
            var changedDraft = service.saveDraft(layoutId, save(nextDraft.revision(), changed), TENANT, 1L);
            assertThat(service.getPublishedVersion(layoutId, published.versionId(), TENANT).document()
                    .path("elements").get(1).path("name").asText()).isEqualTo("F-01");
            assertThatThrownBy(() -> service.restoreVersion(layoutId, published.versionId(), TENANT, 1L))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("未确认草稿");
            assertThat(changedDraft.revision()).isEqualTo(1);
        }
    }

    @Test
    void restoresPublishedVersionByReplacingOnlyAnUntouchedDraft() throws Exception {
        try (SqlSession session = sessions.openSession(true)) {
            SpatialLayoutService service = service(session);
            long roomId = insertCi("idc_room", "310机房", "{}");
            long rackId = insertCi("rack", "H-01机柜", "{\"rack_height_u\":42}");
            link(roomId, rackId, "room_contains_rack");
            SpatialCreateLayoutRequest create = new SpatialCreateLayoutRequest();
            create.setRoomInstanceId(roomId);
            create.setName("310机房布局");
            long layoutId = service.create(create, TENANT, 1L).layoutId();
            var initial = service.getDraft(layoutId, TENANT);
            var published = service.publish(layoutId,
                    publish(service.saveDraft(layoutId, save(initial.revision(), validDocument(rackId)), TENANT, 1L).revision()), TENANT, 1L);
            var previousDraft = service.getDraft(layoutId, TENANT);

            var restored = service.restoreVersion(layoutId, published.versionId(), TENANT, 1L);

            assertThat(restored.versionId()).isNotEqualTo(previousDraft.versionId());
            assertThat(restored.sourceVersionId()).isEqualTo(published.versionId());
            assertThat(restored.document()).isEqualTo(published.document());
            assertThat(bindingCount(restored.versionId())).isEqualTo(1);
        }
    }

    @Test
    void archivesPublishedLayoutWithoutRemovingPublishedHistory() throws Exception {
        try (SqlSession session = sessions.openSession(true)) {
            SpatialLayoutService service = service(session);
            long roomId = insertCi("idc_room", "311机房", "{}");
            long rackId = insertCi("rack", "J-01机柜", "{\"rack_height_u\":42}");
            link(roomId, rackId, "room_contains_rack");
            SpatialCreateLayoutRequest create = new SpatialCreateLayoutRequest();
            create.setRoomInstanceId(roomId);
            create.setName("311机房布局");
            long layoutId = service.create(create, TENANT, 1L).layoutId();
            var draft = service.getDraft(layoutId, TENANT);
            var published = service.publish(layoutId,
                    publish(service.saveDraft(layoutId, save(draft.revision(), validDocument(rackId)), TENANT, 1L).revision()), TENANT, 1L);

            assertThat(service.list(TENANT, false)).extracting(value -> value.layoutId()).contains(layoutId);
            service.archive(layoutId, TENANT, 1L);

            assertThat(service.list(TENANT, false)).extracting(value -> value.layoutId()).doesNotContain(layoutId);
            assertThat(service.list(TENANT, true)).filteredOn(value -> value.layoutId().equals(layoutId))
                    .singleElement().extracting(value -> value.status()).isEqualTo("ARCHIVED");
            assertThat(service.listVersions(layoutId, TENANT)).extracting(value -> value.versionId()).contains(published.versionId());
            assertThat(service.getPublishedVersion(layoutId, published.versionId(), TENANT).document()).isEqualTo(published.document());
        }
    }

    @Test
    void restoresArchivedLayoutUnlessAnotherActiveLayoutNowUsesTheRoom() throws Exception {
        try (SqlSession session = sessions.openSession(true)) {
            SpatialLayoutService service = service(session);
            long roomId = insertCi("idc_room", "312机房", "{}");
            long rackId = insertCi("rack", "K-01机柜", "{\"rack_height_u\":42}");
            link(roomId, rackId, "room_contains_rack");
            SpatialCreateLayoutRequest create = new SpatialCreateLayoutRequest();
            create.setRoomInstanceId(roomId);
            create.setName("312机房原布局");
            long archivedLayoutId = service.create(create, TENANT, 1L).layoutId();
            service.archive(archivedLayoutId, TENANT, 1L);

            service.restoreActive(archivedLayoutId, TENANT, 1L);
            assertThat(service.list(TENANT, false)).extracting(value -> value.layoutId()).contains(archivedLayoutId);
            service.archive(archivedLayoutId, TENANT, 1L);

            SpatialCreateLayoutRequest replacement = new SpatialCreateLayoutRequest();
            replacement.setRoomInstanceId(roomId);
            replacement.setName("312机房新布局");
            long activeLayoutId = service.create(replacement, TENANT, 1L).layoutId();
            assertThatThrownBy(() -> service.restoreActive(archivedLayoutId, TENANT, 1L))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("已有活动空间布局，无法恢复");
            assertThat(service.list(TENANT, false)).extracting(value -> value.layoutId()).contains(activeLayoutId).doesNotContain(archivedLayoutId);
            assertThat(service.list(TENANT, true)).filteredOn(value -> value.layoutId().equals(archivedLayoutId))
                    .singleElement().extracting(value -> value.status()).isEqualTo("ARCHIVED");
        }
    }

    @Test
    void runtimeAndLocateQueriesExecuteInPostgresWithoutDuplicateRackResults() throws Exception {
        try (SqlSession session = sessions.openSession(true)) {
            SpatialLayoutService lifecycle = service(session);
            long roomId = insertCi("idc_room", "309机房", "{}");
            long rackId = insertCi("rack", "G-01机柜", "{\"rack_height_u\":42}");
            long deviceId = insertCi("host", "app-01", "{\"u_start\":1,\"u_end\":2,\"management_ip\":\"10.0.0.11\"}");
            link(roomId, rackId, "room_contains_rack");
            link(rackId, deviceId, "rack_contains_host");
            jdbc.update("INSERT INTO cmdb_alert (tenant_id, ci_instance_id, alert_name, severity, status, fingerprint, is_deleted) VALUES (?, ?, '磁盘告警', 'critical', 'firing', ?, FALSE)",
                    TENANT, rackId, "spatial-runtime-alert-" + rackId);
            SpatialCreateLayoutRequest create = new SpatialCreateLayoutRequest();
            create.setRoomInstanceId(roomId);
            create.setName("308运行时布局");
            long layoutId = lifecycle.create(create, TENANT, 1L).layoutId();
            var draft = lifecycle.getDraft(layoutId, TENANT);
            var saved = lifecycle.saveDraft(layoutId, save(draft.revision(), validDocument(rackId)), TENANT, 1L);
            lifecycle.publish(layoutId, publish(saved.revision()), TENANT, 1L);

            SpatialRuntimeService runtime = new SpatialRuntimeService(session.getMapper(SpatialRuntimeMapper.class), session.getMapper(SpatialLayoutMapper.class));
            var overlay = runtime.runtime(layoutId, TENANT);
            assertThat(overlay.elements()).hasSize(1);
            var element = overlay.elements().values().iterator().next();
            assertThat(element.activeAlertCount()).isEqualTo(1);
            assertThat(element.highestSeverity()).isEqualTo("critical");
            assertThat(element.rack().usedU()).isEqualTo(2);
            assertThat(runtime.locateByCi(rackId, TENANT)).hasSize(1);
            assertThat(runtime.locateByCi(deviceId, TENANT)).singleElement()
                    .extracting(value -> value.rackCiInstanceId(), value -> value.targetCiInstanceId())
                    .containsExactly(rackId, deviceId);
            assertThat(runtime.locate("10.0.0.11", 20, TENANT)).hasSize(1);
        }
    }

    @Test
    void tenantBoundaryHidesLayoutsDraftsPublishedVersionsRuntimeAndLocateResults() throws Exception {
        try (SqlSession session = sessions.openSession(true)) {
            SpatialLayoutService lifecycle = service(session);
            long roomId = insertCi(TENANT, "idc_room", "租户边界机房", "{}");
            long rackId = insertCi(TENANT, "rack", "租户边界机柜", "{\"rack_height_u\":42}");
            link(roomId, rackId, "room_contains_rack");
            SpatialCreateLayoutRequest create = new SpatialCreateLayoutRequest();
            create.setRoomInstanceId(roomId);
            create.setName("租户边界布局");
            long layoutId = lifecycle.create(create, TENANT, 1L).layoutId();
            var saved = lifecycle.saveDraft(layoutId, save(lifecycle.getDraft(layoutId, TENANT).revision(), validDocument(rackId)), TENANT, 1L);
            var published = lifecycle.publish(layoutId, publish(saved.revision()), TENANT, 1L);
            SpatialRuntimeService runtime = new SpatialRuntimeService(session.getMapper(SpatialRuntimeMapper.class), session.getMapper(SpatialLayoutMapper.class));

            assertThat(lifecycle.list(OTHER_TENANT, true)).extracting(value -> value.layoutId()).doesNotContain(layoutId);
            assertThatThrownBy(() -> lifecycle.getDraft(layoutId, OTHER_TENANT)).isInstanceOf(BusinessException.class)
                    .hasMessageContaining("空间布局不存在");
            assertThatThrownBy(() -> lifecycle.getPublishedByRoom(roomId, OTHER_TENANT)).isInstanceOf(BusinessException.class)
                    .hasMessageContaining("尚未发布");
            assertThatThrownBy(() -> lifecycle.getPublishedVersion(layoutId, published.versionId(), OTHER_TENANT))
                    .isInstanceOf(BusinessException.class).hasMessageContaining("布局版本不存在");
            assertThatThrownBy(() -> runtime.runtime(layoutId, OTHER_TENANT)).isInstanceOf(BusinessException.class)
                    .hasMessageContaining("空间布局不存在");
            assertThat(runtime.locateByCi(rackId, OTHER_TENANT)).isEmpty();
        }
    }

    @Test
    void savesAndValidatesTheMaximumTwoThousandElementDocumentWithinRequestBudget() {
        try (SqlSession session = sessions.openSession(true)) {
            SpatialLayoutService service = service(session);
            long roomId = insertCi("idc_room", "313性能机房", "{}");
            SpatialCreateLayoutRequest create = new SpatialCreateLayoutRequest();
            create.setRoomInstanceId(roomId);
            create.setName("313性能布局");
            long layoutId = service.create(create, TENANT, 1L).layoutId();
            var draft = service.getDraft(layoutId, TENANT);

            Instant started = Instant.now();
            var saved = service.saveDraft(layoutId, save(draft.revision(), maxElementDocument()), TENANT, 1L);
            var validation = service.validateDraft(layoutId, TENANT);
            Duration elapsed = Duration.between(started, Instant.now());

            assertThat(saved.elementCount()).isEqualTo(2000);
            assertThat(validation.valid()).isTrue();
            assertThat(elapsed).isLessThan(Duration.ofSeconds(10));
        }
    }

    private static SpatialLayoutService service(SqlSession session) {
        return new SpatialLayoutService(
                session.getMapper(SpatialLayoutMapper.class), session.getMapper(SpatialLayoutVersionMapper.class),
                session.getMapper(SpatialBindingMapper.class), session.getMapper(SpatialAssetMapper.class),
                session.getMapper(SpatialVersionAssetMapper.class), session.getMapper(SpatialCmdbReadMapper.class),
                new SpatialDocumentValidator(), session.getMapper(AuditLogMapper.class), JSON);
    }

    private static SpatialSaveDraftRequest save(int revision, JsonNode document) {
        SpatialSaveDraftRequest request = new SpatialSaveDraftRequest();
        request.setRevision(revision);
        request.setSchemaVersion(1);
        request.setDocument(document);
        return request;
    }

    private static SpatialPublishRequest publish(int revision) {
        SpatialPublishRequest request = new SpatialPublishRequest();
        request.setRevision(revision);
        request.setChangeSummary("首次发布");
        return request;
    }

    private static JsonNode validDocument(long rackId) throws Exception {
        return JSON.readTree("""
            {"schemaVersion":1,"canvas":{"logicalWidth":1600,"logicalHeight":1000},"elements":[
              {"id":"00000000-0000-0000-0000-000000000001","type":"ROOM_OUTLINE","name":"308机房","geometry":{"kind":"POLYGON","points":[[0.05,0.05],[0.95,0.05],[0.95,0.95],[0.05,0.95]]}},
              {"id":"00000000-0000-0000-0000-000000000002","type":"RACK_SLOT","name":"F-01","geometry":{"kind":"RECT","x":0.2,"y":0.2,"width":0.05,"height":0.1,"rotation":0},"rack":{"rowCode":"F","positionNo":"01","slotState":"OCCUPIED"},"binding":{"ciInstanceId":%d}}
            ]}
            """.formatted(rackId));
    }

    private static JsonNode maxElementDocument() {
        ObjectNode document = JSON.createObjectNode();
        document.put("schemaVersion", 1);
        ObjectNode canvas = document.putObject("canvas");
        canvas.put("logicalWidth", 1600);
        canvas.put("logicalHeight", 1000);
        ArrayNode elements = document.putArray("elements");
        ObjectNode outline = elements.addObject();
        outline.put("id", "00000000-0000-0000-0000-000000000001");
        outline.put("type", "ROOM_OUTLINE");
        outline.put("name", "313性能机房");
        ArrayNode outlinePoints = outline.putObject("geometry").put("kind", "POLYGON").putArray("points");
        outlinePoints.addArray().add(0.01).add(0.01);
        outlinePoints.addArray().add(0.99).add(0.01);
        outlinePoints.addArray().add(0.99).add(0.99);
        outlinePoints.addArray().add(0.01).add(0.99);
        for (int index = 2; index <= 2000; index++) {
            ObjectNode text = elements.addObject();
            text.put("id", "00000000-0000-0000-0000-" + String.format("%012d", index));
            text.put("type", "TEXT");
            text.put("name", "性能标注" + index);
            ObjectNode geometry = text.putObject("geometry");
            geometry.put("kind", "RECT");
            geometry.put("x", ((index - 2) % 40) * 0.024 + 0.02);
            geometry.put("y", ((index - 2) / 40) * 0.018 + 0.02);
            geometry.put("width", 0.01);
            geometry.put("height", 0.01);
        }
        return document;
    }

    private static int bindingCount(long versionId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM ci_spatial_binding WHERE layout_version_id = ?", Integer.class, versionId);
    }

    private static long insertCi(String modelId, String name, String attrs) {
        return insertCi(TENANT, modelId, name, attrs);
    }

    private static long insertCi(String tenantId, String modelId, String name, String attrs) {
        return jdbc.queryForObject("INSERT INTO ci_instance (tenant_id, model_id, name, status, attrs, is_deleted) VALUES (?, ?, ?, 'online', ?::jsonb, FALSE) RETURNING id",
                Long.class, tenantId, modelId, name, attrs);
    }

    private static void link(long sourceId, long targetId, String definition) {
        jdbc.update("INSERT INTO ci_instance_rel (tenant_id, def_id, src_id, dst_id, attrs, is_deleted) VALUES (?, ?, ?, ?, '{}'::jsonb, FALSE)",
                TENANT, definition, sourceId, targetId);
    }
}
