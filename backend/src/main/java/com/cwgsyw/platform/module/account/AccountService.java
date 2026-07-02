package com.cwgsyw.platform.module.account;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.SecurityErrorCode;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.account.dto.*;
import com.cwgsyw.platform.module.user.PhoneNormalizer;
import com.cwgsyw.platform.module.user.RequiredActionResolver;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.module.user.password.PasswordHistoryService;
import com.cwgsyw.platform.module.user.password.PasswordHistorySource;
import com.cwgsyw.platform.module.user.password.PasswordPolicyService;
import com.cwgsyw.platform.config.SecurityProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;

/**
 * 当前登录用户的自助资料/改密/首次 setup 服务（SPEC 11.2）。
 * setup、password 都必须在单一事务内完成密码与 profile 的联动更新（SPEC 16.1-16.2）。
 */
@Service
@RequiredArgsConstructor
public class AccountService {

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final PasswordPolicyService passwordPolicyService;
    private final PasswordHistoryService passwordHistoryService;
    private final RequiredActionResolver requiredActionResolver;
    private final AuditLogMapper auditLogMapper;
    private final SecurityProperties securityProperties;

    public AccountProfileResponse getProfile(Long userId) {
        User user = requireUser(userId);
        return toResponse(user);
    }

    @Transactional
    public AccountProfileResponse updateProfile(Long userId, UpdateAccountProfileRequest req) {
        User user = requireUser(userId);

        String beforeJson = auditSnapshot(user);

        if (req.getEmail() != null) {
            String email = req.getEmail().trim();
            assertEmailNotUsedByOthers(email, userId, user.getTenantId());
            user.setEmail(email);
        }
        if (req.getPhone() != null) {
            user.setPhone(PhoneNormalizer.normalize(req.getPhone()));
        }
        if (req.getAvatarUrl() != null) {
            user.setAvatarUrl(req.getAvatarUrl());
        }
        if (StringUtils.hasText(user.getEmail()) && StringUtils.hasText(user.getPhone())) {
            user.setProfileCompleted(true);
        }
        userMapper.updateById(user);

        auditLogMapper.insert(AuditLog.builder()
            .tenantId(user.getTenantId())
            .module("user")
            .action("profile_update")
            .targetId(userId)
            .targetType("user")
            .operatorId(userId)
            .beforeJson(beforeJson)
            .afterJson(auditSnapshot(user))
            .remark("用户自助更新资料")
            .createdAt(LocalDateTime.now())
            .build());

        return toResponse(user);
    }

    @Transactional
    public AccountProfileResponse changePassword(Long userId, ChangePasswordRequest req) {
        User user = requireUser(userId);

        if (!passwordEncoder.matches(req.getCurrentPassword(), user.getPassword())) {
            throw new BusinessException(400, SecurityErrorCode.CURRENT_PASSWORD_INVALID, "当前密码错误");
        }
        passwordPolicyService.validateConfirmation(req.getNewPassword(), req.getConfirmPassword());
        passwordPolicyService.validateNewPassword(user, req.getNewPassword());
        passwordHistoryService.assertNotRecentlyUsed(userId, req.getNewPassword(), securityProperties.getPassword().getHistoryCount());

        String newHash = passwordEncoder.encode(req.getNewPassword());
        user.setPassword(newHash);
        user.setMustChangePassword(false);
        user.setPasswordChangedAt(LocalDateTime.now());
        userMapper.updateById(user);

        passwordHistoryService.record(userId, user.getTenantId(), newHash, PasswordHistorySource.CHANGE_PASSWORD, userId);

        auditLogMapper.insert(AuditLog.builder()
            .tenantId(user.getTenantId())
            .module("user")
            .action("password_change")
            .targetId(userId)
            .targetType("user")
            .operatorId(userId)
            .remark("用户自助修改密码")
            .createdAt(LocalDateTime.now())
            .build());

        return toResponse(user);
    }

    @Transactional
    public AccountProfileResponse setup(Long userId, AccountSetupRequest req) {
        User user = requireUser(userId);

        if (Boolean.TRUE.equals(user.getMustChangePassword())) {
            if (!StringUtils.hasText(req.getCurrentPassword()) || !StringUtils.hasText(req.getNewPassword())) {
                throw new BusinessException(400, SecurityErrorCode.PASSWORD_POLICY_VIOLATION, "请填写当前密码和新密码");
            }
            if (!passwordEncoder.matches(req.getCurrentPassword(), user.getPassword())) {
                throw new BusinessException(400, SecurityErrorCode.CURRENT_PASSWORD_INVALID, "当前密码错误");
            }
            passwordPolicyService.validateConfirmation(req.getNewPassword(), req.getConfirmPassword());
            passwordPolicyService.validateNewPassword(user, req.getNewPassword());
            passwordHistoryService.assertNotRecentlyUsed(userId, req.getNewPassword(), securityProperties.getPassword().getHistoryCount());

            String newHash = passwordEncoder.encode(req.getNewPassword());
            user.setPassword(newHash);
            user.setMustChangePassword(false);
            user.setPasswordChangedAt(LocalDateTime.now());
            passwordHistoryService.record(userId, user.getTenantId(), newHash, PasswordHistorySource.CHANGE_PASSWORD, userId);

            auditLogMapper.insert(AuditLog.builder()
                .tenantId(user.getTenantId())
                .module("user")
                .action("first_password_change")
                .targetId(userId)
                .targetType("user")
                .operatorId(userId)
                .remark("首次登录强制改密")
                .createdAt(LocalDateTime.now())
                .build());
        }

        String beforeJson = auditSnapshot(user);
        String email = req.getEmail().trim();
        assertEmailNotUsedByOthers(email, userId, user.getTenantId());
        user.setEmail(email);
        user.setPhone(PhoneNormalizer.normalize(req.getPhone()));
        if (req.getAvatarUrl() != null) {
            user.setAvatarUrl(req.getAvatarUrl());
        }
        user.setProfileCompleted(true);
        userMapper.updateById(user);

        auditLogMapper.insert(AuditLog.builder()
            .tenantId(user.getTenantId())
            .module("user")
            .action("profile_update")
            .targetId(userId)
            .targetType("user")
            .operatorId(userId)
            .beforeJson(beforeJson)
            .afterJson(auditSnapshot(user))
            .remark("首次登录补全资料")
            .createdAt(LocalDateTime.now())
            .build());

        return toResponse(user);
    }

    private User requireUser(Long userId) {
        User user = userMapper.selectById(userId);
        if (user == null) throw new IllegalArgumentException("用户不存在");
        return user;
    }

    private void assertEmailNotUsedByOthers(String email, Long userId, String tenantId) {
        if (!StringUtils.hasText(email)) return;
        User existing = userMapper.selectOne(new LambdaQueryWrapper<User>()
            .eq(User::getTenantId, tenantId)
            .eq(User::getEmail, email)
            .ne(User::getId, userId)
            .last("LIMIT 1"));
        if (existing != null) {
            throw new BusinessException(400, SecurityErrorCode.EMAIL_ALREADY_USED, "该邮箱已被其他用户使用");
        }
    }

    private AccountProfileResponse toResponse(User user) {
        AccountProfileResponse resp = new AccountProfileResponse();
        resp.setId(user.getId());
        resp.setUsername(user.getUsername());
        resp.setRealName(user.getRealName());
        resp.setEmail(user.getEmail());
        resp.setPhone(user.getPhone());
        resp.setAvatarUrl(user.getAvatarUrl());
        resp.setMustChangePassword(user.getMustChangePassword());
        resp.setProfileCompleted(user.getProfileCompleted());
        resp.setPasswordChangedAt(user.getPasswordChangedAt());
        resp.setLastLoginAt(user.getLastLoginAt());
        resp.setRequiredActions(requiredActionResolver.resolve(user));
        return resp;
    }

    private String auditSnapshot(User user) {
        return "{\"email\":\"" + escape(user.getEmail()) + "\",\"phone\":\"" + escape(user.getPhone())
            + "\",\"avatarUrl\":\"" + escape(user.getAvatarUrl()) + "\"}";
    }

    private String escape(String value) {
        if (value == null) return "";
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
