package com.cwgsyw.platform.module.device;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.config.CryptoService;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.device.dto.*;
import com.cwgsyw.platform.module.device.entity.Device;
import com.cwgsyw.platform.module.device.entity.DeviceCredential;
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
    private final CiInstanceMapper ciInstanceMapper;
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
        Long filterGroupId = "group".equals(callerGroupScope) ? callerGroupId : null;
        return toVO(device, true, filterGroupId);
    }

    @Transactional
    public Device create(CreateDeviceRequest req, String tenantId, Long operatorId) {
        if (req.getCiInstanceId() == null) {
            throw new IllegalArgumentException("必须关联 CMDB 实例");
        }
        CiInstance ci = ciInstanceMapper.selectById(req.getCiInstanceId());
        if (ci == null || ci.getIsDeleted() || !ci.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("CMDB 实例不存在");
        }

        Device device = new Device();
        device.setTenantId(tenantId);
        device.setGroupId(req.getGroupId());
        device.setCiInstanceId(req.getCiInstanceId());
        // 从 CI 派生 name/IP/type 并快照存储（供 fallback）
        device.setName(ci.getName());
        device.setIp(extractIp(ci));
        device.setDeviceType(mapModelToDeviceType(ci.getModelId()));
        device.setCategory(req.getCategory());
        device.setDescription(req.getDescription());

        deviceMapper.insert(device);
        writeAudit(tenantId, "create", device.getId(), operatorId,
            "ci_instance_id=" + req.getCiInstanceId() + " name=" + device.getName());
        return device;
    }

    @Transactional
    public void update(Long id, CreateDeviceRequest req, String tenantId, Long operatorId) {
        Device device = deviceMapper.selectById(id);
        if (device == null || device.getIsDeleted() || !device.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("设备不存在");
        }
        // name/ip/deviceType/ciInstanceId 不可修改（由 CI 派生）；只允许 category/description/groupId
        if (req.getCategory() != null) device.setCategory(req.getCategory());
        if (req.getDescription() != null) device.setDescription(req.getDescription());
        if (req.getGroupId() != null) device.setGroupId(req.getGroupId());
        deviceMapper.updateById(device);
        writeAudit(tenantId, "update", id, operatorId, "name=" + device.getName());
    }

    @Transactional
    public void delete(Long id, String tenantId, Long operatorId) {
        Device device = deviceMapper.selectById(id);
        if (device == null || device.getIsDeleted() || !device.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("设备不存在");
        }
        device.setDeletedAt(LocalDateTime.now());
        device.setDeletedBy(operatorId);
        deviceMapper.updateById(device);
        deviceMapper.deleteById(id);
        writeAudit(tenantId, "delete", id, operatorId, null);
    }

    @Transactional
    public DeviceCredential addCredential(Long deviceId, CreateCredentialRequest req,
                                          String tenantId, Long operatorId, Long callerGroupId) {
        Device device = deviceMapper.selectById(deviceId);
        if (device == null || device.getIsDeleted() || !device.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("设备不存在");
        }
        Long groupId = req.getGroupId() != null ? req.getGroupId() : callerGroupId;
        DeviceCredential cred = new DeviceCredential();
        cred.setDeviceId(deviceId);
        cred.setTenantId(tenantId);
        cred.setGroupId(groupId);
        cred.setUsername(req.getUsername());
        cred.setPasswordEnc(crypto.encrypt(req.getPassword()));
        cred.setDescription(req.getDescription());
        credentialMapper.insert(cred);
        writeAudit(tenantId, "add_credential", deviceId, operatorId,
            "username=" + req.getUsername() + " group_id=" + groupId);
        return cred;
    }

    @Transactional
    public void deleteCredential(Long credentialId, String tenantId, Long operatorId) {
        DeviceCredential cred = credentialMapper.selectById(credentialId);
        if (cred == null || cred.getIsDeleted()) throw new IllegalArgumentException("账号不存在");
        Device device = deviceMapper.selectById(cred.getDeviceId());
        if (device == null || !device.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("账号不存在");
        }
        cred.setDeletedAt(LocalDateTime.now());
        cred.setDeletedBy(operatorId);
        credentialMapper.updateById(cred);
        credentialMapper.deleteById(cred.getId());
        writeAudit(tenantId, "delete_credential", cred.getDeviceId(), operatorId, null);
    }

    // @Transactional deliberately omitted: audit committed independently so a decrypt failure
    // cannot roll back the audit record.
    public String revealPassword(Long credentialId, String tenantId, Long operatorId,
                                 Long callerGroupId, String callerGroupScope,
                                 String operatorIp, String clientPublicKey) {
        DeviceCredential cred = credentialMapper.selectById(credentialId);
        if (cred == null || cred.getIsDeleted()) throw new IllegalArgumentException("账号不存在");
        Device device = deviceMapper.selectById(cred.getDeviceId());
        if (device == null || !device.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("账号不存在");
        }
        // Group-level authorization: members may only reveal their own group's credentials
        if ("group".equals(callerGroupScope)) {
            if (cred.getGroupId() == null || !cred.getGroupId().equals(callerGroupId)) {
                throw new IllegalArgumentException("无权查看该凭据");
            }
        }
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(tenantId).module("device").action("view_password")
            .targetId(credentialId).targetType("device_credential")
            .operatorId(operatorId).operatorIp(operatorIp)
            .remark("credential_id=" + credentialId + " device_id=" + cred.getDeviceId())
            .createdAt(LocalDateTime.now()).build());

        String plaintext = crypto.decrypt(cred.getPasswordEnc());
        // Envelope encryption: if client supplied a public key, encrypt the plaintext with it
        // so plaintext never travels over the wire. Falls back to plaintext when no key is given
        // (e.g. dev/HTTP environments where Web Crypto is unavailable).
        if (clientPublicKey != null && !clientPublicKey.isBlank()) {
            return crypto.encryptForClient(plaintext, clientPublicKey);
        }
        return plaintext;
    }

    // ── private helpers ──────────────────────────────────────────────────────

    private DeviceVO toVO(Device d, boolean includeCredentials) {
        return toVO(d, includeCredentials, null);
    }

    private DeviceVO toVO(Device d, boolean includeCredentials, Long filterGroupId) {
        DeviceVO vo = new DeviceVO();
        vo.setId(d.getId());
        vo.setGroupId(d.getGroupId());
        vo.setCiInstanceId(d.getCiInstanceId());
        vo.setCategory(d.getCategory());
        vo.setDescription(d.getDescription());
        vo.setCreatedAt(d.getCreatedAt());
        vo.setUpdatedAt(d.getUpdatedAt());

        if (d.getCiInstanceId() != null) {
            CiInstance ci = ciInstanceMapper.selectById(d.getCiInstanceId());
            if (ci != null && !ci.getIsDeleted()) {
                // CMDB is the single source of truth for name/IP/type
                vo.setName(ci.getName());
                vo.setCiInstanceName(ci.getName());
                vo.setIp(extractIp(ci));
                vo.setDeviceType(mapModelToDeviceType(ci.getModelId()));
            } else {
                // Fallback: CI was deleted — show stored snapshot and warn
                vo.setName(d.getName());
                vo.setIp(d.getIp());
                vo.setDeviceType(d.getDeviceType());
                vo.setCiInstanceName("(CI 已删除)");
            }
        } else {
            // Legacy device without CI link — show stored values
            vo.setName(d.getName());
            vo.setIp(d.getIp());
            vo.setDeviceType(d.getDeviceType());
        }

        if (includeCredentials) {
            if (d.getGroupId() != null) {
                var group = groupMapper.selectById(d.getGroupId());
                if (group != null) vo.setGroupName(group.getName());
            }
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

    /** Extract inner_ip from CI attrs (host model); returns null for models without this attr. */
    private static String extractIp(CiInstance ci) {
        if (ci.getFieldsData() == null) return null;
        Object v = ci.getFieldsData().get("inner_ip");
        return v != null ? String.valueOf(v) : null;
    }

    /** Map CMDB modelId to the device_type enum used by the password vault. */
    private static String mapModelToDeviceType(String modelId) {
        if (modelId == null) return "other";
        return switch (modelId) {
            case "host", "app" -> "server";
            case "switch", "router" -> "network";
            case "firewall" -> "security";
            default -> "other";
        };
    }

    private void writeAudit(String tenantId, String action, Long targetId,
                            Long operatorId, String remark) {
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(tenantId).module("device").action(action)
            .targetId(targetId).targetType("device")
            .operatorId(operatorId).remark(remark)
            .createdAt(LocalDateTime.now()).build());
    }
}
