package com.cwgsyw.platform.module.cmdb.alert;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.alert.entity.CmdbAlert;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class CmdbAlertRemediationService {
    private final CmdbAlertMapper alertMapper;
    private final AuditLogMapper auditLogMapper;

    @Transactional
    public void purgeRemediationTest(SecurityUser user, Long id, String remediationRunId) {
        if (!"platform".equals(user.getGroupScope())) {
            throw new IllegalArgumentException("仅平台管理员可以清理整改测试告警");
        }
        if (remediationRunId == null || remediationRunId.isBlank()) {
            throw new IllegalArgumentException("缺少 remediationRunId");
        }

        CmdbAlert alert = alertMapper.selectById(id);
        if (alert == null || !user.getTenantId().equals(alert.getTenantId())) {
            throw new IllegalArgumentException("告警不存在");
        }
        if (!containsExactRunId(alert, remediationRunId)) {
            throw new IllegalArgumentException("仅允许清理内容带 remediationRunId 的测试告警");
        }

        LocalDateTime now = LocalDateTime.now();
        alert.setDeletedAt(now);
        alert.setDeletedBy(user.getUserId());
        alert.setUpdatedAt(now);
        alert.setUpdatedBy(user.getUserId());
        alertMapper.updateById(alert);
        alertMapper.deleteById(id);

        auditLogMapper.insert(AuditLog.builder()
                .tenantId(user.getTenantId())
                .module("cmdb")
                .action("purge_remediation_test")
                .targetId(id)
                .targetType("cmdb_alert")
                .operatorId(user.getUserId())
                .remark("remediationRunId=" + remediationRunId)
                .createdAt(now)
                .build());
    }

    private boolean containsExactRunId(CmdbAlert alert, String remediationRunId) {
        return Stream.of(alert.getAlertName(), alert.getSummary(), alert.getDescription(), alert.getRawLabels())
                .filter(value -> value != null)
                .anyMatch(value -> value.equals(remediationRunId)
                        || value.contains("\"" + remediationRunId + "\""));
    }
}
