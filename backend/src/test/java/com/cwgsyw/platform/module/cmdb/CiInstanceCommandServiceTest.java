package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.changedoc.ChangeDocCiLinkMapper;
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
import com.cwgsyw.platform.module.device.DeviceMapper;
import com.cwgsyw.platform.module.device.entity.Device;
import com.cwgsyw.platform.module.daily.DailyReportMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

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
        instance.setIsDeleted(false);
        return instance;
    }

    @BeforeEach
    void setUp() {
        when(ciInstanceMapper.findActiveByIdForUpdate(42L, "default")).thenReturn(activeInstance());
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
