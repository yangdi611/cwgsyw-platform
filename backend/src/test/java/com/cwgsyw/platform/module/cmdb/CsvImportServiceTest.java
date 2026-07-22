package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.AuditSnapshotSerializer;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.dto.csv.CsvImportResultVO;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.mapper.CiAttributeMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import com.cwgsyw.platform.module.cmdb.service.CsvImportService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.HashOperations;

import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CsvImportServiceTest {
    @Mock private CiModelMapper ciModelMapper;
    @Mock private CiAttributeMapper ciAttributeMapper;
    @Mock private CiInstanceMapper ciInstanceMapper;
    @Mock private AuditLogMapper auditLogMapper;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOperations;
    @Mock private HashOperations<String, Object, Object> hashOperations;
    @Spy private ObjectMapper objectMapper = new ObjectMapper();
    @Spy private AuditSnapshotSerializer auditSnapshotSerializer = new AuditSnapshotSerializer(objectMapper);
    @InjectMocks private CsvImportService service;

    @Test
    void executeCreateWritesJsonSnapshotAndKeepsBatchSuccessful() throws Exception {
        String rows = objectMapper.writeValueAsString(List.of(Map.of(
                "_action", "create", "_modelId", "host", "name", "import-target", "assetTag", "CSV-001")));
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(redisTemplate.opsForHash()).thenReturn(hashOperations);
        when(valueOperations.get("cmdb:import:preview:batch-1")).thenReturn(rows);
        when(valueOperations.get("cmdb:import:tenant:batch-1")).thenReturn("default");
        when(ciInstanceMapper.insert(any(CiInstance.class))).thenAnswer(invocation -> {
            invocation.getArgument(0, CiInstance.class).setId(81L);
            return 1;
        });

        CsvImportResultVO result = service.execute("batch-1", "default", 9L);

        assertThat(result.getCreated()).isEqualTo(1);
        assertThat(result.getFailed()).isZero();
        ArgumentCaptor<AuditLog> auditCaptor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogMapper).insert(auditCaptor.capture());
        assertThat(objectMapper.readTree(auditCaptor.getValue().getAfterJson()).isObject()).isTrue();
        assertThat(auditCaptor.getValue().getRemark()).isEqualTo("batch_id=batch-1");
        assertThat(auditCaptor.getValue().getAfterJson()).doesNotContain("batch_id");
        verify(valueOperations).set(
                eq("cmdb:import:failed:batch-1"),
                org.mockito.ArgumentMatchers.contains("\"tenantId\":\"default\""),
                eq(600L), eq(java.util.concurrent.TimeUnit.SECONDS));
        verify(redisTemplate).delete(eq("cmdb:import:preview:batch-1"));
        verify(redisTemplate).delete(eq("cmdb:import:tenant:batch-1"));
    }

    @Test
    void downloadFailedRowsUsesTenantBoundSnapshotAndEscapesCsvCells() throws Exception {
        Map<String, Object> rowData = new LinkedHashMap<>();
        rowData.put("asset_name", "\t=SUM(A1:A2)");
        rowData.put("description", "quoted,\nvalue");
        String snapshot = objectMapper.writeValueAsString(Map.of(
                "tenantId", "tenant-a",
                "failedRows", List.of(Map.of(
                        "rowNumber", 2,
                        "reason", "实例不存在",
                        "rowData", rowData))));
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cmdb:import:failed:batch-2")).thenReturn(snapshot);

        String csv = new String(service.downloadFailedRows("batch-2", "tenant-a"), java.nio.charset.StandardCharsets.UTF_8);

        assertThat(csv).contains("asset_name,description,行号,失败原因");
        assertThat(csv).contains("'\t=SUM(A1:A2)");
        assertThat(csv).contains("\"quoted,\nvalue\"");
        assertThat(csv).contains("2,实例不存在");
    }

    @Test
    void downloadFailedRowsRejectsDifferentTenant() throws Exception {
        String snapshot = objectMapper.writeValueAsString(Map.of(
                "tenantId", "tenant-a", "failedRows", List.of()));
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cmdb:import:failed:batch-3")).thenReturn(snapshot);

        org.assertj.core.api.Assertions.assertThatThrownBy(
                () -> service.downloadFailedRows("batch-3", "tenant-b"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("无权下载该导入结果");
    }

    @Test
    void downloadFailedRowsReturnsValidHeadersForEmptyFailureSet() throws Exception {
        String snapshot = objectMapper.writeValueAsString(Map.of(
                "tenantId", "tenant-a", "failedRows", List.of()));
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cmdb:import:failed:batch-4")).thenReturn(snapshot);

        String csv = new String(service.downloadFailedRows("batch-4", "tenant-a"),
                java.nio.charset.StandardCharsets.UTF_8);

        assertThat(csv).contains("行号,失败原因");
    }

    @Test
    void executeRejectsBatchOwnedByDifferentTenant() throws Exception {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cmdb:import:preview:batch-5")).thenReturn("[]");
        when(valueOperations.get("cmdb:import:tenant:batch-5")).thenReturn("tenant-a");

        org.assertj.core.api.Assertions.assertThatThrownBy(
                () -> service.execute("batch-5", "tenant-b", 9L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("无权执行该导入批次");
    }
}
