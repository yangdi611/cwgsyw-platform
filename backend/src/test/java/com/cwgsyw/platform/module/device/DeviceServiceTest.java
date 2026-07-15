package com.cwgsyw.platform.module.device;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.config.CryptoService;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelGroupMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import com.cwgsyw.platform.module.device.dto.CreateDeviceRequest;
import com.cwgsyw.platform.module.device.entity.Device;
import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import com.cwgsyw.platform.module.org.GroupMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DeviceServiceTest {

    @Mock private DeviceMapper deviceMapper;
    @Mock private DeviceCredentialMapper credentialMapper;
    @Mock private CryptoService crypto;
    @Mock private AuditLogMapper auditLogMapper;
    @Mock private CiInstanceMapper ciInstanceMapper;
    @Mock private CiModelMapper ciModelMapper;
    @Mock private CiModelGroupMapper ciModelGroupMapper;
    @Mock private GroupMapper groupMapper;
    @Mock private ActiveGroupReferenceValidator activeGroupReferenceValidator;
    @InjectMocks private DeviceService service;

    @Test
    void createRejectsDuplicateActiveDeviceForCi() {
        CreateDeviceRequest request = new CreateDeviceRequest();
        request.setCiInstanceId(42L);
        CiInstance instance = new CiInstance();
        instance.setId(42L);
        instance.setTenantId("default");
        instance.setModelId("host");
        instance.setName("test-host");
        instance.setIsDeleted(false);
        when(ciInstanceMapper.findActiveByIdForUpdate(42L, "default")).thenReturn(instance);
        when(deviceMapper.selectCount(any())).thenReturn(1L);

        assertThatThrownBy(() -> service.create(request, "default", 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("该 CMDB 实例已关联设备");

        verify(deviceMapper, never()).insert(any(Device.class));
        verifyNoInteractions(auditLogMapper);
    }
}
