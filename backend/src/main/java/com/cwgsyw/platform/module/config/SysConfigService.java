package com.cwgsyw.platform.module.config;

import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.config.entity.SysConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SysConfigService {
    private final SysConfigMapper configMapper;
    private final AuditLogMapper auditLogMapper;

    public String get(String tenantId, String key) {
        String val = configMapper.findValue(tenantId, key);
        return val != null ? val : "";
    }

    public boolean getBoolean(String tenantId, String key) {
        return "true".equalsIgnoreCase(get(tenantId, key));
    }

    public Map<String, String> getAll(String tenantId) {
        List<SysConfig> rows = configMapper.findByTenant(tenantId);
        if (rows == null) return Collections.emptyMap();
        return rows.stream()
            .collect(Collectors.toMap(SysConfig::getConfigKey,
                c -> c.getConfigValue() != null ? c.getConfigValue() : ""));
    }

    public void set(String tenantId, String key, String value) {
        configMapper.update(null, new LambdaUpdateWrapper<SysConfig>()
            .eq(SysConfig::getTenantId, tenantId)
            .eq(SysConfig::getConfigKey, key)
            .set(SysConfig::getConfigValue, value)
            .set(SysConfig::getUpdatedAt, LocalDateTime.now()));
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(tenantId)
            .module("sys_config")
            .action("update")
            .targetType("sys_config")
            .operatorId(0L)
            .remark("key=" + key)
            .createdAt(LocalDateTime.now())
            .build());
    }
}
