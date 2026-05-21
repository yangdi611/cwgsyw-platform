package com.cwgsyw.platform.module.device;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.config.CryptoService;
import com.cwgsyw.platform.module.device.dto.*;
import com.cwgsyw.platform.module.device.entity.Device;
import com.cwgsyw.platform.module.device.entity.DeviceCredential;
import com.cwgsyw.platform.module.org.GroupMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DeviceService {
    private final DeviceMapper deviceMapper;
    private final DeviceCredentialMapper credentialMapper;
    private final CryptoService crypto;
    private final AuditLogMapper auditLogMapper;
    private final GroupMapper groupMapper;

    public PageResult<DeviceVO> list(Long groupId, String deviceType, String category,
                                     int page, int size, String tenantId) {
        LambdaQueryWrapper<Device> query = new LambdaQueryWrapper<Device>()
            .eq(Device::getTenantId, tenantId)
            .eq(Device::getIsDeleted, false)
            .orderByDesc(Device::getCreatedAt);
        if (groupId != null) query.eq(Device::getGroupId, groupId);
        if (deviceType != null) query.eq(Device::getDeviceType, deviceType);
        if (category != null) query.eq(Device::getCategory, category);
        Page<Device> p = deviceMapper.selectPage(new Page<>(page, size), query);
        return PageResult.of(p.convert(d -> toVO(d, false)));
    }

    public DeviceVO getById(Long id, String tenantId) {
        Device device = deviceMapper.selectById(id);
        if (device == null || device.getIsDeleted() || !device.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("设备不存在");
        }
        return toVO(device, true);
    }

    @Transactional
    public Device create(CreateDeviceRequest req, String tenantId, Long operatorId) {
        Device device = new Device();
        device.setTenantId(tenantId);
        device.setGroupId(req.getGroupId());
        device.setName(req.getName());
        device.setIp(req.getIp());
        device.setDeviceType(req.getDeviceType() != null ? req.getDeviceType() : "server");
        device.setCategory(req.getCategory());
        device.setDescription(req.getDescription());
        deviceMapper.insert(device);
        writeAudit(tenantId, "create", device.getId(), operatorId, null,
            "{\"name\":\"" + device.getName() + "\"}");
        return device;
    }

    @Transactional
    public void update(Long id, CreateDeviceRequest req, String tenantId, Long operatorId) {
        Device device = deviceMapper.selectById(id);
        if (device == null || device.getIsDeleted() || !device.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("设备不存在");
        }
        if (req.getName() != null) device.setName(req.getName());
        if (req.getIp() != null) device.setIp(req.getIp());
        if (req.getDeviceType() != null) device.setDeviceType(req.getDeviceType());
        if (req.getCategory() != null) device.setCategory(req.getCategory());
        if (req.getDescription() != null) device.setDescription(req.getDescription());
        if (req.getGroupId() != null) device.setGroupId(req.getGroupId());
        deviceMapper.updateById(device);
        writeAudit(tenantId, "update", id, operatorId, null,
            "{\"name\":\"" + device.getName() + "\"}");
    }

    @Transactional
    public void delete(Long id, String tenantId, Long operatorId) {
        Device device = deviceMapper.selectById(id);
        if (device == null || device.getIsDeleted() || !device.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("设备不存在");
        }
        device.setIsDeleted(true);
        device.setDeletedAt(LocalDateTime.now());
        device.setDeletedBy(operatorId);
        deviceMapper.updateById(device);
        writeAudit(tenantId, "delete", id, operatorId, null, null);
    }

    @Transactional
    public DeviceCredential addCredential(Long deviceId, CreateCredentialRequest req,
                                          String tenantId, Long operatorId) {
        Device device = deviceMapper.selectById(deviceId);
        if (device == null || device.getIsDeleted() || !device.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("设备不存在");
        }
        DeviceCredential cred = new DeviceCredential();
        cred.setDeviceId(deviceId);
        cred.setUsername(req.getUsername());
        cred.setPasswordEnc(crypto.encrypt(req.getPassword()));
        cred.setDescription(req.getDescription());
        credentialMapper.insert(cred);
        writeAudit(tenantId, "add_credential", deviceId, operatorId, null,
            "{\"username\":\"" + req.getUsername() + "\"}");
        return cred;
    }

    @Transactional
    public void deleteCredential(Long credentialId, String tenantId, Long operatorId) {
        DeviceCredential cred = credentialMapper.selectById(credentialId);
        if (cred == null || cred.getIsDeleted()) throw new IllegalArgumentException("账号不存在");
        cred.setIsDeleted(true);
        cred.setDeletedAt(LocalDateTime.now());
        cred.setDeletedBy(operatorId);
        credentialMapper.updateById(cred);
        writeAudit(tenantId, "delete_credential", cred.getDeviceId(), operatorId, null, null);
    }

    @Transactional
    public String revealPassword(Long credentialId, String tenantId, Long operatorId, String operatorIp) {
        DeviceCredential cred = credentialMapper.selectById(credentialId);
        if (cred == null || cred.getIsDeleted()) throw new IllegalArgumentException("账号不存在");
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(tenantId)
            .module("device")
            .action("view_password")
            .targetId(credentialId)
            .targetType("device_credential")
            .operatorId(operatorId)
            .operatorIp(operatorIp)
            .remark("credential_id=" + credentialId + " device_id=" + cred.getDeviceId())
            .createdAt(LocalDateTime.now())
            .build());
        return crypto.decrypt(cred.getPasswordEnc());
    }

    private DeviceVO toVO(Device d, boolean includeCredentials) {
        DeviceVO vo = new DeviceVO();
        vo.setId(d.getId());
        vo.setGroupId(d.getGroupId());
        vo.setName(d.getName());
        vo.setIp(d.getIp());
        vo.setDeviceType(d.getDeviceType());
        vo.setCategory(d.getCategory());
        vo.setDescription(d.getDescription());
        vo.setCreatedAt(d.getCreatedAt());
        vo.setUpdatedAt(d.getUpdatedAt());
        if (d.getGroupId() != null) {
            var group = groupMapper.selectById(d.getGroupId());
            if (group != null) vo.setGroupName(group.getName());
        }
        if (includeCredentials) {
            List<CredentialVO> creds = credentialMapper.findByDeviceId(d.getId())
                .stream().map(c -> {
                    CredentialVO cv = new CredentialVO();
                    cv.setId(c.getId());
                    cv.setDeviceId(c.getDeviceId());
                    cv.setUsername(c.getUsername());
                    cv.setDescription(c.getDescription());
                    cv.setCreatedAt(c.getCreatedAt());
                    return cv;
                }).collect(Collectors.toList());
            vo.setCredentials(creds);
        }
        return vo;
    }

    private void writeAudit(String tenantId, String action, Long targetId,
                            Long operatorId, String before, String after) {
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(tenantId)
            .module("device")
            .action(action)
            .targetId(targetId)
            .targetType("device")
            .operatorId(operatorId)
            .beforeJson(before)
            .afterJson(after)
            .createdAt(LocalDateTime.now())
            .build());
    }
}
