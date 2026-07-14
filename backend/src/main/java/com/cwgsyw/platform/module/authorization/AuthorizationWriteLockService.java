package com.cwgsyw.platform.module.authorization;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

@Service
@RequiredArgsConstructor
public class AuthorizationWriteLockService {
    private final AuthorizationWriteLockMapper lockMapper;

    public void lockUserAuthorization(String tenantId, Long userId) {
        lock("user-authorization:" + tenantId + ":" + userId);
    }

    public void lockRoleAuthorization(String tenantId, Long roleId) {
        lock("role-authorization:" + tenantId + ":" + roleId);
    }

    public void lockGroupAssignment(String tenantId, Long userId, Long groupId) {
        lock("group-assignment:" + tenantId + ":" + userId + ":" + groupId);
    }

    private void lock(String source) {
        if (!TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("authorization write lock requires an active transaction");
        }
        byte[] digest;
        try {
            digest = MessageDigest.getInstance("SHA-256")
                .digest(source.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
        long lockKey = ByteBuffer.wrap(digest).getLong();
        lockMapper.lock(lockKey);
    }
}
