package com.cwgsyw.platform.module.auth;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.auth.dto.*;
import com.cwgsyw.platform.module.auth.session.AuthSessionRecord;
import com.cwgsyw.platform.module.auth.session.AuthSessionService;
import com.cwgsyw.platform.module.auth.session.AuthSessionStatus;
import com.cwgsyw.platform.module.auth.session.SessionValidationResult;
import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.user.RequiredActionResolver;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.security.JwtUtil;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final RbacService rbacService;
    private final AuthSessionService authSessionService;
    private final RequiredActionResolver requiredActionResolver;
    private final AuditLogMapper auditLogMapper;

    @Transactional
    public LoginResponse login(LoginRequest req, String userAgent, String clientIp) {
        User user = userMapper.findByUsername(req.getUsername()).orElse(null);
        if (user == null || !passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            recordAuth("login_failed", user != null ? user.getId() : null, clientIp,
                user != null ? user.getTenantId() : "default", "用户名或密码错误");
            throw new BadCredentialsException("用户名或密码错误");
        }
        if (user.getStatus() != 1) {
            recordAuth("login_failed", user.getId(), clientIp, user.getTenantId(), "账号已禁用");
            throw new IllegalArgumentException("账号已禁用");
        }

        Set<String> permissions = rbacService.getUserPermissions(user.getId());
        String scope = rbacService.getHighestScope(user.getId());
        List<String> requiredActions = requiredActionResolver.resolve(user);

        // 创建 Redis 可撤销会话（Redis 不可用时安全失败，抛 503，不默认放行）
        AuthSessionRecord session = authSessionService.createSession(user, userAgent, clientIp);
        String token = jwtUtil.generateToken(user.getId(), user.getUsername(), user.getTenantId(), session.getSessionId());

        user.setLastLoginAt(LocalDateTime.now());
        user.setLastLoginIp(clientIp);
        userMapper.updateById(user);

        recordAuth("login_success", user.getId(), clientIp, user.getTenantId(), null);

        return new LoginResponse(token, user.getId(), user.getUsername(), user.getRealName(),
            user.getAvatarUrl(), scope, user.getGroupId(), permissions, requiredActions);
    }

    /** 幂等：session 已不存在也返回成功。 */
    public void logout() {
        SecurityUser current = currentUser();
        if (current == null) return;
        authSessionService.revoke(current.getSessionId(), current.getUserId(), "USER_LOGOUT");
        recordAuth("logout", current.getUserId(), null, current.getTenantId(), shortSessionId(current.getSessionId()));
    }

    public SessionTouchResponse touch() {
        SecurityUser current = currentUser();
        if (current == null) {
            throw new IllegalStateException("未登录");
        }
        authSessionService.touch(current.getSessionId(), current.getUserId());
        SessionValidationResult result = authSessionService.validate(current.getSessionId(), current.getUserId());
        AuthSessionRecord session = result.getSession();
        SessionTouchResponse resp = new SessionTouchResponse();
        resp.setSessionId(current.getSessionId());
        if (session != null) {
            resp.setLastActiveAt(session.getLastActiveAt());
            resp.setExpiresAt(session.getExpiresAt());
        }
        return resp;
    }

    public AuthSessionRecord currentSession() {
        SecurityUser current = currentUser();
        if (current == null) {
            throw new IllegalStateException("未登录");
        }
        SessionValidationResult result = authSessionService.validate(current.getSessionId(), current.getUserId());
        if (result.getStatus() != AuthSessionStatus.VALID) {
            throw new IllegalStateException("会话已失效");
        }
        return result.getSession();
    }

    private SecurityUser currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof SecurityUser su)) return null;
        return su;
    }

    private String shortSessionId(String sessionId) {
        if (sessionId == null || sessionId.length() < 8) return sessionId;
        return sessionId.substring(sessionId.length() - 8);
    }

    private void recordAuth(String action, Long userId, String clientIp, String tenantId, String remark) {
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(tenantId != null ? tenantId : "default")
            .module("auth")
            .action(action)
            .targetId(userId)
            .targetType("user")
            .operatorId(userId != null ? userId : 0L)
            .operatorIp(clientIp)
            .remark(remark)
            .createdAt(LocalDateTime.now())
            .build());
    }
}
