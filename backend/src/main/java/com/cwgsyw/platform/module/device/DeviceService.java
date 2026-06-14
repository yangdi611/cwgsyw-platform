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
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.org.GroupMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DeviceService {
    private final DeviceMapper deviceMapper;
    private final DeviceCredentialMapper credentialMapper;
    private final CryptoService crypto;
    private final AuditLogMapper auditLogMapper;
    private final GroupMapper groupMapper;
    private final CiInstanceMapper ciInstanceMapper;

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

        // Batch fetch group names to avoid N+1
        Set<Long> groupIds = p.getRecords().stream()
            .filter(d -> d.getGroupId() != null)
            .map(Device::getGroupId)
            .collect(Collectors.toSet());
        Map<Long, String> groupNames = groupIds.isEmpty()
            ? Map.of()
            : groupMapper.selectBatchIds(groupIds).stream()
                .collect(Collectors.toMap(
                    com.cwgsyw.platform.module.org.entity.Group::getId,
                    com.cwgsyw.platform.module.org.entity.Group::getName));

        return PageResult.of(p.convert(d -> {
            DeviceVO vo = toVO(d, false);
            if (d.getGroupId() != null) vo.setGroupName(groupNames.get(d.getGroupId()));
            return vo;
        }));
    }

    public DeviceVO getById(Long id, String tenantId, Long callerGroupId, String callerGroupScope) {
        Device device = deviceMapper.selectById(id);
        if (device == null || device.getIsDeleted() || !device.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("设备不存在");
        }
        // group scope members only see their own group's credentials
        Long filterGroupId = "group".equals(callerGroupScope) ? callerGroupId : null;
        return toVO(device, true, filterGroupId);
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
        device.setCiInstanceId(req.getCiInstanceId());
        deviceMapper.insert(device);
        writeAudit(tenantId, "create", device.getId(), operatorId, "name=" + device.getName());
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
        if (req.getCiInstanceId() != null) device.setCiInstanceId(req.getCiInstanceId());
        deviceMapper.updateById(device);
        writeAudit(tenantId, "update", id, operatorId, "name=" + device.getName());
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
        writeAudit(tenantId, "delete", id, operatorId, null);
    }

    @Transactional
    public DeviceCredential addCredential(Long deviceId, CreateCredentialRequest req,
                                          String tenantId, Long operatorId, Long callerGroupId) {
        Device device = deviceMapper.selectById(deviceId);
        if (device == null || device.getIsDeleted() || !device.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("设备不存在");
        }
        // Use explicitly provided groupId, or fall back to caller's group
        Long groupId = req.getGroupId() != null ? req.getGroupId() : callerGroupId;
        DeviceCredential cred = new DeviceCredential();
        cred.setDeviceId(deviceId);
        cred.setTenantId(tenantId);
        cred.setGroupId(groupId);
        cred.setUsername(req.getUsername());
        cred.setPasswordEnc(crypto.encrypt(req.getPassword()));
        cred.setDescription(req.getDescription());
        credentialMapper.insert(cred);
        writeAudit(tenantId, "add_credential", deviceId, operatorId, "username=" + req.getUsername() + " group_id=" + groupId);
        return cred;
    }

    @Transactional
    public void deleteCredential(Long credentialId, String tenantId, Long operatorId) {
        DeviceCredential cred = credentialMapper.selectById(credentialId);
        if (cred == null || cred.getIsDeleted()) throw new IllegalArgumentException("账号不存在");
        // Fix 1: verify parent device belongs to caller's tenant
        Device device = deviceMapper.selectById(cred.getDeviceId());
        if (device == null || !device.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("账号不存在");
        }
        cred.setIsDeleted(true);
        cred.setDeletedAt(LocalDateTime.now());
        cred.setDeletedBy(operatorId);
        credentialMapper.updateById(cred);
        writeAudit(tenantId, "delete_credential", cred.getDeviceId(), operatorId, null);
    }

    // Fix 2: @Transactional removed — audit is written first and committed independently;
    // a decrypt failure will not roll back the audit record.
    public String revealPassword(Long credentialId, String tenantId, Long operatorId, String operatorIp) {
        DeviceCredential cred = credentialMapper.selectById(credentialId);
        if (cred == null || cred.getIsDeleted()) throw new IllegalArgumentException("账号不存在");
        // Fix 1: verify parent device belongs to caller's tenant
        Device device = deviceMapper.selectById(cred.getDeviceId());
        if (device == null || !device.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("账号不存在");
        }
        // Audit is written (and auto-committed) before decrypt is attempted
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

    // toVO for list path (no credentials)
    private DeviceVO toVO(Device d, boolean includeCredentials) {
        return toVO(d, includeCredentials, null);
    }

    // toVO with optional group filter for credentials (null = show all groups)
    private DeviceVO toVO(Device d, boolean includeCredentials, Long filterGroupId) {
        DeviceVO vo = new DeviceVO();
        vo.setId(d.getId());
        vo.setGroupId(d.getGroupId());
        vo.setName(d.getName());
        vo.setIp(d.getIp());
        vo.setDeviceType(d.getDeviceType());
        vo.setCategory(d.getCategory());
        vo.setDescription(d.getDescription());
        vo.setCiInstanceId(d.getCiInstanceId());
        if (d.getCiInstanceId() != null) {
            vo.setCiInstanceName(deviceMapper.findCiInstanceName(d.getCiInstanceId()));
        }
        vo.setCreatedAt(d.getCreatedAt());
        vo.setUpdatedAt(d.getUpdatedAt());
        if (includeCredentials) {
            // Single group lookup is fine for getById (single device)
            if (d.getGroupId() != null) {
                var group = groupMapper.selectById(d.getGroupId());
                if (group != null) vo.setGroupName(group.getName());
            }
            // Batch-fetch all groups once for credential group names
            List<DeviceCredential> allCreds = credentialMapper.findByDeviceId(d.getId());
            Set<Long> credGroupIds = allCreds.stream()
                .filter(c -> c.getGroupId() != null)
                .map(DeviceCredential::getGroupId)
                .collect(Collectors.toSet());
            Map<Long, String> credGroupNames = credGroupIds.isEmpty()
                ? Map.of()
                : groupMapper.selectBatchIds(credGroupIds).stream()
                    .collect(Collectors.toMap(
                        com.cwgsyw.platform.module.org.entity.Group::getId,
                        com.cwgsyw.platform.module.org.entity.Group::getName));

            List<CredentialVO> creds = allCreds.stream()
                .filter(c -> filterGroupId == null || filterGroupId.equals(c.getGroupId()))
                .map(c -> {
                    CredentialVO cv = new CredentialVO();
                    cv.setId(c.getId());
                    cv.setDeviceId(c.getDeviceId());
                    cv.setGroupId(c.getGroupId());
                    cv.setGroupName(c.getGroupId() != null ? credGroupNames.get(c.getGroupId()) : null);
                    cv.setUsername(c.getUsername());
                    cv.setDescription(c.getDescription());
                    cv.setCreatedAt(c.getCreatedAt());
                    return cv;
                }).collect(Collectors.toList());
            vo.setCredentials(creds);
        }
        return vo;
    }

    // Fix 3: remark-based audit — no JSON string concatenation, no malformed-JSON risk
    private void writeAudit(String tenantId, String action, Long targetId,
                            Long operatorId, String remark) {
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(tenantId)
            .module("device")
            .action(action)
            .targetId(targetId)
            .targetType("device")
            .operatorId(operatorId)
            .remark(remark)
            .createdAt(LocalDateTime.now())
            .build());
    }
}
