package com.cwgsyw.platform.module.device;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.config.CryptoService;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelGroupMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import com.cwgsyw.platform.module.device.dto.CreateDeviceRequest;
import com.cwgsyw.platform.module.device.dto.UpdateCredentialRequest;
import com.cwgsyw.platform.module.device.entity.Device;
import com.cwgsyw.platform.module.device.entity.DeviceCredential;
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

        assertThatThrownBy(() -> service.create(request, "default", 1L, null, "tenant"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("该 CMDB 实例已关联设备");

        verify(deviceMapper, never()).insert(any(Device.class));
        verifyNoInteractions(auditLogMapper);
    }

    @Test
    void getByIdRejectsDeviceOutsideGroupScope() {
        Device device = new Device();
        device.setId(42L);
        device.setTenantId("default");
        device.setGroupId(2L);
        device.setIsDeleted(false);
        when(deviceMapper.selectById(42L)).thenReturn(device);

        assertThatThrownBy(() -> service.getById(42L, "default", 3L, "group"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("无权访问该设备");
    }

    @Test
    void createRejectsOtherGroupForGroupScope() {
        CreateDeviceRequest request = new CreateDeviceRequest();
        request.setCiInstanceId(42L);
        request.setGroupId(2L);

        assertThatThrownBy(() -> service.create(request, "default", 1L, 3L, "group"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("无权指定其他用户组");

        verifyNoInteractions(activeGroupReferenceValidator, ciInstanceMapper, deviceMapper);
    }

    @Test
    void updateCredentialPersistsMaskedFieldsAndAudits() {
        DeviceCredential credential = new DeviceCredential();
        credential.setId(10L);
        credential.setTenantId("default");
        credential.setDeviceId(42L);
        credential.setGroupId(2L);
        credential.setIsDeleted(false);
        Device device = new Device();
        device.setId(42L);
        device.setTenantId("default");
        device.setGroupId(2L);
        device.setIsDeleted(false);
        UpdateCredentialRequest request = new UpdateCredentialRequest();
        request.setUsername("rotated-user");
        request.setPassword("rotated-password");
        request.setDescription("rotated description");
        when(credentialMapper.selectById(10L)).thenReturn(credential);
        when(deviceMapper.selectById(42L)).thenReturn(device);
        when(crypto.encrypt("rotated-password")).thenReturn("encrypted");

        service.updateCredential(10L, request, "default", 1L, 2L, "group");

        verify(credentialMapper).updateById(credential);
        verify(auditLogMapper).insert(any(com.cwgsyw.platform.common.entity.AuditLog.class));
        org.assertj.core.api.Assertions.assertThat(credential.getUsername()).isEqualTo("rotated-user");
        org.assertj.core.api.Assertions.assertThat(credential.getPasswordEnc()).isEqualTo("encrypted");
    }

    @Test
    void groupScopeRejectsCredentialWritesAndRevealOutsideDeviceGroup() {
        DeviceCredential credential = new DeviceCredential();
        credential.setId(10L);
        credential.setTenantId("default");
        credential.setDeviceId(42L);
        credential.setGroupId(2L);
        credential.setIsDeleted(false);
        Device device = new Device();
        device.setId(42L);
        device.setTenantId("default");
        device.setGroupId(2L);
        device.setIsDeleted(false);
        UpdateCredentialRequest updateRequest = new UpdateCredentialRequest();
        updateRequest.setUsername("should-not-persist");
        CreateDeviceRequest deviceRequest = new CreateDeviceRequest();
        deviceRequest.setCiInstanceId(42L);

        when(credentialMapper.selectById(10L)).thenReturn(credential);
        when(deviceMapper.selectById(42L)).thenReturn(device);

        assertThatThrownBy(() -> service.updateCredential(10L, updateRequest, "default", 1L, 3L, "group"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("无权访问该设备");
        assertThatThrownBy(() -> service.deleteCredential(10L, "default", 1L, 3L, "group"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("无权访问该设备");
        assertThatThrownBy(() -> service.revealPassword(10L, "default", 1L, 3L, "group", "127.0.0.1", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("无权访问该设备");
        assertThatThrownBy(() -> service.addCredential(42L, new com.cwgsyw.platform.module.device.dto.CreateCredentialRequest(),
                "default", 1L, 3L, "group"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("无权访问该设备");

        verify(credentialMapper, never()).insert(any(DeviceCredential.class));
        verify(credentialMapper, never()).updateById(any(DeviceCredential.class));
        verify(credentialMapper, never()).deleteById(any(Long.class));
        verifyNoInteractions(auditLogMapper, crypto, activeGroupReferenceValidator);
    }
}
