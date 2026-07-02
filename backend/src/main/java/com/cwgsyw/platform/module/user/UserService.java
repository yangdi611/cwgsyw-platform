package com.cwgsyw.platform.module.user;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.SecurityErrorCode;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.config.SecurityProperties;
import com.cwgsyw.platform.module.auth.session.AuthSessionRecord;
import com.cwgsyw.platform.module.auth.session.AuthSessionService;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.user.dto.*;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.module.user.password.PasswordHistoryService;
import com.cwgsyw.platform.module.user.password.PasswordHistorySource;
import com.cwgsyw.platform.module.user.password.PasswordPolicyService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final RbacService rbacService;
    private final GroupMapper groupMapper;
    private final AuditLogMapper auditLogMapper;
    private final PasswordPolicyService passwordPolicyService;
    private final PasswordHistoryService passwordHistoryService;
    private final AuthSessionService authSessionService;
    private final SecurityProperties securityProperties;

    public PageResult<User> list(int page, int size, String tenantId, String keyword) {
        LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<User>()
            .eq(User::getTenantId, tenantId);
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w
                .like(User::getUsername, keyword)
                .or()
                .like(User::getRealName, keyword)
                .or()
                .like(User::getEmail, keyword));
        }
        Page<User> p = userMapper.selectPage(new Page<>(page, size), wrapper);
        return PageResult.of(p);
    }

    /** 全局搜索：按用户名或姓名模糊匹配，限制返回条数。供统一搜索（/api/search）复用。 */
    public List<User> searchByName(String keyword, int limit, String tenantId) {
        if (!StringUtils.hasText(keyword)) return List.of();
        return userMapper.selectList(new LambdaQueryWrapper<User>()
            .eq(User::getTenantId, tenantId)
            .and(w -> w.like(User::getUsername, keyword).or().like(User::getRealName, keyword))
            .last("LIMIT " + limit));
    }

    @Transactional
    public User create(CreateUserRequest req, String tenantId, Long operatorId) {
        if (userMapper.findByUsername(req.getUsername()).isPresent()) {
            throw new IllegalArgumentException("用户名已存在");
        }
        passwordPolicyService.validateNewPassword(req.getUsername(), req.getPassword());

        User user = new User();
        user.setTenantId(tenantId);
        user.setUsername(req.getUsername());
        String passwordHash = passwordEncoder.encode(req.getPassword());
        user.setPassword(passwordHash);
        user.setRealName(req.getRealName());
        user.setEmail(req.getEmail());
        user.setPhone(req.getPhone());
        user.setGroupId(req.getGroupId());
        user.setStatus(1);
        // 首次登录强制改密 + 补全资料（SPEC 11.4）：email/phone 都非空才视为已完成
        user.setMustChangePassword(true);
        user.setProfileCompleted(StringUtils.hasText(req.getEmail()) && StringUtils.hasText(req.getPhone()));
        userMapper.insert(user);
        if (req.getRoleIds() != null && !req.getRoleIds().isEmpty()) {
            rbacService.assignRolesToUser(user.getId(), req.getRoleIds());
        }

        passwordHistoryService.record(user.getId(), tenantId, passwordHash, PasswordHistorySource.CREATE_USER, operatorId);

        // Audit log
        String afterJson = toAuditJson(user, "***");
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(tenantId)
            .module("user")
            .action("create")
            .targetId(user.getId())
            .targetType("user")
            .operatorId(operatorId)
            .afterJson(afterJson)
            .remark("创建用户: " + user.getUsername())
            .createdAt(LocalDateTime.now())
            .build());

        return user;
    }

    @Transactional
    public void update(Long id, UpdateUserRequest req, Long operatorId) {
        User user = userMapper.selectById(id);
        if (user == null) throw new IllegalArgumentException("用户不存在");

        // Snapshot before update for audit log
        String beforeJson = toAuditJson(user, "***");

        if (req.getRealName() != null) user.setRealName(req.getRealName());
        if (req.getEmail() != null) user.setEmail(req.getEmail());
        if (req.getPhone() != null) user.setPhone(req.getPhone());
        if (req.getGroupId() != null) user.setGroupId(req.getGroupId());
        boolean disabling = req.getStatus() != null && req.getStatus() != 1 && user.getStatus() != null && user.getStatus() == 1;
        if (req.getStatus() != null) user.setStatus(req.getStatus());
        userMapper.updateById(user);
        if (req.getRoleIds() != null) {
            rbacService.assignRolesToUser(id, req.getRoleIds());
        }

        // 管理员禁用用户后撤销该用户所有会话（SPEC 11.4）
        if (disabling) {
            authSessionService.revokeAllForUser(id, operatorId, "ADMIN_DISABLE");
            auditLogMapper.insert(AuditLog.builder()
                .tenantId(user.getTenantId())
                .module("user")
                .action("disable")
                .targetId(id)
                .targetType("user")
                .operatorId(operatorId)
                .remark("禁用用户: " + user.getUsername())
                .createdAt(LocalDateTime.now())
                .build());
        }

        // Audit log
        String afterJson = toAuditJson(user, "***");
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(user.getTenantId())
            .module("user")
            .action("update")
            .targetId(id)
            .targetType("user")
            .operatorId(operatorId)
            .beforeJson(beforeJson)
            .afterJson(afterJson)
            .remark("更新用户: " + user.getUsername())
            .createdAt(LocalDateTime.now())
            .build());
    }

    @Transactional
    public void delete(Long id, Long operatorId) {
        User user = userMapper.selectById(id);
        if (user == null) throw new IllegalArgumentException("用户不存在");

        // Snapshot before delete for audit log
        String beforeJson = toAuditJson(user, "***");

        user.setIsDeleted(true);
        user.setDeletedBy(operatorId);
        user.setDeletedAt(LocalDateTime.now());
        userMapper.updateById(user);
        userMapper.deleteById(id);

        // 删除用户前撤销所有会话（SPEC 11.4）
        authSessionService.revokeAllForUser(id, operatorId, "ADMIN_DELETE");

        // Audit log
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(user.getTenantId())
            .module("user")
            .action("delete")
            .targetId(id)
            .targetType("user")
            .operatorId(operatorId)
            .beforeJson(beforeJson)
            .remark("删除用户: " + user.getUsername())
            .createdAt(LocalDateTime.now())
            .build());
    }

    public UserDetailVO getDetail(Long id, String tenantId) {
        User user = userMapper.selectOne(
            new LambdaQueryWrapper<User>()
                .eq(User::getId, id)
                .eq(User::getTenantId, tenantId));
        if (user == null) throw new IllegalArgumentException("用户不存在");

        UserDetailVO vo = new UserDetailVO();
        vo.setId(user.getId());
        vo.setUsername(user.getUsername());
        vo.setRealName(user.getRealName());
        vo.setEmail(user.getEmail());
        vo.setPhone(user.getPhone());
        vo.setStatus(user.getStatus());
        vo.setGroupId(user.getGroupId());

        if (user.getGroupId() != null) {
            Group group = groupMapper.selectById(user.getGroupId());
            if (group != null) {
                vo.setGroupName(group.getName());
            }
        }

        vo.setRoleIds(rbacService.getUserRoleIds(id));
        return vo;
    }

    /** 管理员重置密码（SPEC 11.3）：不需要当前密码，仍执行密码策略、用户名包含、历史校验。 */
    @Transactional
    public void resetPassword(Long id, ResetPasswordRequest req, Long operatorId) {
        User user = userMapper.selectById(id);
        if (user == null) throw new IllegalArgumentException("用户不存在");

        passwordPolicyService.validateConfirmation(req.getNewPassword(), req.getConfirmPassword());
        passwordPolicyService.validateNewPassword(user, req.getNewPassword());
        passwordHistoryService.assertNotRecentlyUsed(id, req.getNewPassword(), securityProperties.getPassword().getHistoryCount());

        String newHash = passwordEncoder.encode(req.getNewPassword());
        user.setPassword(newHash);
        user.setMustChangePassword(true);
        userMapper.updateById(user);

        passwordHistoryService.record(id, user.getTenantId(), newHash, PasswordHistorySource.RESET_PASSWORD, operatorId);
        authSessionService.revokeAllForUser(id, operatorId, "PASSWORD_RESET");

        auditLogMapper.insert(AuditLog.builder()
            .tenantId(user.getTenantId())
            .module("user")
            .action("password_reset")
            .targetId(id)
            .targetType("user")
            .operatorId(operatorId)
            .remark("管理员重置密码: " + user.getUsername())
            .createdAt(LocalDateTime.now())
            .build());
    }

    /** 管理员强制下线（SPEC 11.3）。 */
    public void revokeSessions(Long id, Long operatorId) {
        User user = userMapper.selectById(id);
        if (user == null) throw new IllegalArgumentException("用户不存在");
        authSessionService.revokeAllForUser(id, operatorId, "ADMIN_REVOKE");

        auditLogMapper.insert(AuditLog.builder()
            .tenantId(user.getTenantId())
            .module("auth")
            .action("session_revoked")
            .targetId(id)
            .targetType("user")
            .operatorId(operatorId)
            .remark("管理员强制下线: " + user.getUsername())
            .createdAt(LocalDateTime.now())
            .build());
    }

    /** 第一阶段返回 Redis 中当前 session 摘要（SPEC 11.3）。 */
    public List<AuthSessionRecord> listSessions(Long id) {
        return authSessionService.listUserSessions(id);
    }

    /**
     * Build hand-written JSON for audit log (without Jackson).
     * Password field is masked with the given placeholder.
     */
    private String toAuditJson(User user, String passwordMask) {
        StringBuilder sb = new StringBuilder();
        sb.append("{");
        sb.append("\"id\":").append(user.getId()).append(",");
        sb.append("\"username\":\"").append(escape(user.getUsername())).append("\",");
        sb.append("\"realName\":\"").append(escape(user.getRealName())).append("\",");
        sb.append("\"email\":\"").append(escape(user.getEmail())).append("\",");
        sb.append("\"phone\":\"").append(escape(user.getPhone())).append("\",");
        sb.append("\"status\":").append(user.getStatus()).append(",");
        sb.append("\"groupId\":").append(user.getGroupId()).append(",");
        sb.append("\"password\":\"").append(passwordMask).append("\"");
        sb.append("}");
        return sb.toString();
    }

    /**
     * Escape special characters for JSON string values.
     */
    private String escape(String value) {
        if (value == null) return "";
        return value
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t");
    }
}
