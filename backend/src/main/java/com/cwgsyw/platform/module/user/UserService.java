package com.cwgsyw.platform.module.user;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.user.dto.*;
import com.cwgsyw.platform.module.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final RbacService rbacService;
    private final GroupMapper groupMapper;
    private final AuditLogMapper auditLogMapper;

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

    @Transactional
    public User create(CreateUserRequest req, String tenantId, Long operatorId) {
        if (userMapper.findByUsername(req.getUsername()).isPresent()) {
            throw new IllegalArgumentException("用户名已存在");
        }
        User user = new User();
        user.setTenantId(tenantId);
        user.setUsername(req.getUsername());
        user.setPassword(passwordEncoder.encode(req.getPassword()));
        user.setRealName(req.getRealName());
        user.setEmail(req.getEmail());
        user.setPhone(req.getPhone());
        user.setGroupId(req.getGroupId());
        user.setStatus(1);
        userMapper.insert(user);
        if (req.getRoleIds() != null && !req.getRoleIds().isEmpty()) {
            rbacService.assignRolesToUser(user.getId(), req.getRoleIds());
        }

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
        if (req.getStatus() != null) user.setStatus(req.getStatus());
        if (req.getPassword() != null) user.setPassword(passwordEncoder.encode(req.getPassword()));
        userMapper.updateById(user);
        if (req.getRoleIds() != null) {
            rbacService.assignRolesToUser(id, req.getRoleIds());
        }

        // Audit log
        String afterJson = toAuditJson(user, req.getPassword() != null ? "***" : "***");
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

    /**
     * Build hand-written JSON for audit log (without Jackson).
     * Password field is masked with the given placeholder.
     */
    private String toAuditJson(User user, String passwordMask) {
        StringBuilder sb = new StringBuilder();
        sb.append("{");
        sb.append("\"id\":").append(user.getId()).append(",");
        sb.append("\"username\":\"").append(escape(user.getUsername())).append("\",");
        sb.append("\"real_name\":\"").append(escape(user.getRealName())).append("\",");
        sb.append("\"email\":\"").append(escape(user.getEmail())).append("\",");
        sb.append("\"phone\":\"").append(escape(user.getPhone())).append("\",");
        sb.append("\"status\":").append(user.getStatus()).append(",");
        sb.append("\"group_id\":").append(user.getGroupId()).append(",");
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
