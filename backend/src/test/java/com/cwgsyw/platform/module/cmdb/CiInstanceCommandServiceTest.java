package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.changedoc.ChangeDocCiLinkMapper;
import com.cwgsyw.platform.module.cmdb.dto.instance.BatchUpdateInstanceRequest;
import com.cwgsyw.platform.module.cmdb.dto.instance.BatchUpdateResultVO;
import com.cwgsyw.platform.module.cmdb.dto.instance.UpdateInstanceRequest;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.entity.CiChangeRecord;
import com.cwgsyw.platform.module.cmdb.mapper.CiAttributeMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiChangeRecordMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceRelMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import com.cwgsyw.platform.module.cmdb.service.CiChangeService;
import com.cwgsyw.platform.module.cmdb.service.CiFieldSchemaValidator;
import com.cwgsyw.platform.module.cmdb.service.CiInstanceCommandService;
import com.cwgsyw.platform.module.cmdb.service.CiInstanceQueryService;
import com.cwgsyw.platform.module.cmdb.service.CiInstanceUniquenessValidator;
import com.cwgsyw.platform.module.cmdb.service.CiNotificationService;
import com.cwgsyw.platform.module.device.DeviceMapper;
import com.cwgsyw.platform.module.device.entity.Device;
import com.cwgsyw.platform.module.daily.DailyReportMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.Map;

@ExtendWith(MockitoExtension.class)
class CiInstanceCommandServiceTest {

    @Mock private CiInstanceMapper ciInstanceMapper;
    @Mock private CiModelMapper ciModelMapper;
    @Mock private CiAttributeMapper ciAttributeMapper;
    @Mock private CiInstanceRelMapper ciInstanceRelMapper;
    @Mock private DeviceMapper deviceMapper;
    @Mock private ChangeDocCiLinkMapper changeDocCiLinkMapper;
    @Mock private DailyReportMapper dailyReportMapper;
    @Mock private AuditLogMapper auditLogMapper;
    @Mock private CiChangeRecordMapper ciChangeRecordMapper;
    @Mock private ObjectMapper objectMapper;
    @Mock private CiChangeService ciChangeService;
    @Mock private CiNotificationService ciNotificationService;
    @Mock private PlatformTransactionManager transactionManager;
    @Mock private CiFieldSchemaValidator schemaValidator;
    @Mock private CiInstanceUniquenessValidator uniquenessValidator;
    @Mock private CiInstanceQueryService ciInstanceQueryService;
    @InjectMocks private CiInstanceCommandService service;

    private CiInstance activeInstance() {
        CiInstance instance = new CiInstance();
        instance.setId(42L);
        instance.setTenantId("default");
        instance.setModelId("host");
        instance.setName("test-host");
        instance.setStatus("online");
        instance.setIsDeleted(false);
        return instance;
    }

    @BeforeEach
    void setUp() {
        lenient().when(ciInstanceMapper.findActiveByIdForUpdate(42L, "default")).thenReturn(activeInstance());
    }

    @Test
    void updateWithChangedStatusNotifiesExactlyOnce() {
        CiInstance instance = activeInstance();
        when(ciInstanceMapper.selectById(42L)).thenReturn(instance);
        UpdateInstanceRequest request = new UpdateInstanceRequest();
        request.setStatus("offline");

        service.update(42L, request, "default", 1L);

        InOrder order = inOrder(ciInstanceMapper, auditLogMapper, ciChangeRecordMapper, ciNotificationService);
        order.verify(ciInstanceMapper).updateById(instance);
        order.verify(auditLogMapper).insert(any(AuditLog.class));
        ArgumentCaptor<CiChangeRecord> changeCaptor = ArgumentCaptor.forClass(CiChangeRecord.class);
        order.verify(ciChangeRecordMapper).insert(changeCaptor.capture());
        order.verify(ciNotificationService).notifyStatusChange(instance, "online", "offline", 1L);
        assertThat(changeCaptor.getValue().getFieldChanges()).containsExactly(
                Map.of("field", "status", "before", "online", "after", "offline"));
    }

    @Test
    void updateWithoutStatusDoesNotNotify() {
        CiInstance instance = activeInstance();
        when(ciInstanceMapper.selectById(42L)).thenReturn(instance);
        UpdateInstanceRequest request = new UpdateInstanceRequest();
        request.setDescription("updated");

        service.update(42L, request, "default", 1L);

        assertThat(instance.getStatus()).isEqualTo("online");
        verifyNoInteractions(ciNotificationService);
    }

    @Test
    void updateWithSameStatusDoesNotNotify() {
        CiInstance instance = activeInstance();
        when(ciInstanceMapper.selectById(42L)).thenReturn(instance);
        UpdateInstanceRequest request = new UpdateInstanceRequest();
        request.setStatus("online");

        service.update(42L, request, "default", 1L);

        verify(ciNotificationService, never()).notifyStatusChange(any(), any(), any(), any());
    }

    @Test
    void batchUpdateWithChangedStatusNotifiesEachInstanceExactlyOnce() {
        CiInstance first = activeInstance();
        CiInstance second = activeInstance();
        second.setId(43L);
        second.setName("test-host-2");
        when(ciInstanceMapper.selectById(42L)).thenReturn(first);
        when(ciInstanceMapper.selectById(43L)).thenReturn(second);
        BatchUpdateInstanceRequest request = new BatchUpdateInstanceRequest();
        request.setIds(List.of(42L, 43L));
        request.setFields(Map.of("status", "offline"));

        BatchUpdateResultVO result = service.batchUpdate(request, "default", 1L);

        assertThat(result.getTotal()).isEqualTo(2);
        assertThat(result.getSucceeded()).isEqualTo(2);
        assertThat(result.getFailed()).isZero();
        verify(ciNotificationService).notifyStatusChange(first, "online", "offline", 1L);
        verify(ciNotificationService).notifyStatusChange(second, "online", "offline", 1L);
        verifyNoMoreInteractions(ciNotificationService);
    }

    @Test
    void batchUpdateRollsBackFailedNotificationAndReportsFailure() {
        CiInstance instance = activeInstance();
        when(ciInstanceMapper.selectById(42L)).thenReturn(instance);
        doThrow(new IllegalStateException("notification failed"))
                .when(ciNotificationService).notifyStatusChange(instance, "online", "offline", 1L);
        BatchUpdateInstanceRequest request = new BatchUpdateInstanceRequest();
        request.setIds(List.of(42L));
        request.setFields(Map.of("status", "offline"));

        BatchUpdateResultVO result = service.batchUpdate(request, "default", 1L);

        assertThat(result.getTotal()).isOne();
        assertThat(result.getSucceeded()).isZero();
        assertThat(result.getFailed()).isOne();
        assertThat(result.getFailures()).singleElement()
                .extracting(BatchUpdateResultVO.FailItem::getError)
                .isEqualTo("notification failed");
        verify(transactionManager).rollback(any());
        verify(transactionManager, never()).commit(any());
    }

    @Test
    void updatePropagatesNotificationFailure() {
        CiInstance instance = activeInstance();
        when(ciInstanceMapper.selectById(42L)).thenReturn(instance);
        UpdateInstanceRequest request = new UpdateInstanceRequest();
        request.setStatus("offline");
        doThrow(new IllegalStateException("notification failed"))
                .when(ciNotificationService).notifyStatusChange(instance, "online", "offline", 1L);

        assertThatThrownBy(() -> service.update(42L, request, "default", 1L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("notification failed");

        verify(ciInstanceQueryService, never()).getDetail(any(), any());
        verify(ciChangeService, never()).invalidateStatsCache();
    }

    @Test
    void deleteRejectsActiveRelationWithoutChangingAnyRecord() {
        when(ciInstanceRelMapper.selectCount(any())).thenReturn(1L);

        assertThatThrownBy(() -> service.delete(42L, "default", 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("该 CMDB 实例仍有关联关系，请先解除后再删除");

        verify(deviceMapper, never()).selectCount(any());
        verify(ciInstanceMapper, never()).updateById(any(CiInstance.class));
        verify(ciInstanceMapper, never()).deleteById(any(Long.class));
        verifyNoInteractions(auditLogMapper, ciChangeRecordMapper, ciChangeService);
    }

    @Test
    void deleteRejectsActiveDeviceWithoutChangingAnyRecord() {
        when(ciInstanceRelMapper.selectCount(any())).thenReturn(0L);
        when(deviceMapper.selectCount(any())).thenReturn(1L);

        assertThatThrownBy(() -> service.delete(42L, "default", 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("该 CMDB 实例仍关联设备，请先删除设备后再删除实例");

        verify(ciInstanceMapper, never()).updateById(any(CiInstance.class));
        verify(ciInstanceMapper, never()).deleteById(any(Long.class));
        verifyNoInteractions(auditLogMapper, ciChangeRecordMapper, ciChangeService);
    }

    @Test
    void deleteRejectsActiveChangeDocumentWithoutChangingAnyRecord() {
        when(ciInstanceRelMapper.selectCount(any())).thenReturn(0L);
        when(deviceMapper.selectCount(any())).thenReturn(0L);
        when(changeDocCiLinkMapper.countActiveDocumentReferences("default", 42L)).thenReturn(1L);

        assertThatThrownBy(() -> service.delete(42L, "default", 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("该 CMDB 实例仍被变更文档引用，请先解除引用后再删除实例");

        verifyNoInteractions(dailyReportMapper);
        verify(ciInstanceMapper, never()).updateById(any(CiInstance.class));
        verify(ciInstanceMapper, never()).deleteById(any(Long.class));
        verifyNoInteractions(auditLogMapper, ciChangeRecordMapper, ciChangeService);
    }

    @Test
    void deleteRejectsActiveDailyReportWithoutChangingAnyRecord() {
        when(ciInstanceRelMapper.selectCount(any())).thenReturn(0L);
        when(deviceMapper.selectCount(any())).thenReturn(0L);
        when(changeDocCiLinkMapper.countActiveDocumentReferences("default", 42L)).thenReturn(0L);
        when(dailyReportMapper.countActiveByCiInstanceId("default", 42L)).thenReturn(1L);

        assertThatThrownBy(() -> service.delete(42L, "default", 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("该 CMDB 实例仍被日报引用，请先解除引用后再删除实例");

        verify(ciInstanceMapper, never()).updateById(any(CiInstance.class));
        verify(ciInstanceMapper, never()).deleteById(any(Long.class));
        verifyNoInteractions(auditLogMapper, ciChangeRecordMapper, ciChangeService);
    }

    @Test
    void deleteWithoutReferencesWritesDeleteSideEffectsOnce() throws Exception {
        when(ciInstanceRelMapper.selectCount(any())).thenReturn(0L);
        when(deviceMapper.selectCount(any())).thenReturn(0L);
        when(changeDocCiLinkMapper.countActiveDocumentReferences("default", 42L)).thenReturn(0L);
        when(dailyReportMapper.countActiveByCiInstanceId("default", 42L)).thenReturn(0L);
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");

        assertThatCode(() -> service.delete(42L, "default", 1L)).doesNotThrowAnyException();

        verify(ciInstanceMapper).updateById(any(CiInstance.class));
        verify(ciInstanceMapper).deleteById(42L);
        verify(auditLogMapper).insert(any(AuditLog.class));
        verify(ciChangeRecordMapper).insert(any(CiChangeRecord.class));
        verify(ciChangeService).invalidateStatsCache();
    }
}
