package com.cwgsyw.platform.module.auth;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuthAuditService {
    private final AuditLogMapper auditLogMapper;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailedLogin(Long userId, String clientIp, String tenantId, String remark) {
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(tenantId != null ? tenantId : "default")
            .module("auth")
            .action("login_failed")
            .targetId(userId)
            .targetType("user")
            .operatorId(userId != null ? userId : 0L)
            .operatorIp(clientIp)
            .remark(remark)
            .createdAt(LocalDateTime.now())
            .build());
    }
}
