package com.cwgsyw.platform.module.user;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.user.dto.*;
import com.cwgsyw.platform.module.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final RbacService rbacService;

    public PageResult<User> list(int page, int size, String tenantId) {
        Page<User> p = userMapper.selectPage(new Page<>(page, size),
            new LambdaQueryWrapper<User>().eq(User::getTenantId, tenantId));
        return PageResult.of(p);
    }

    /** 全局搜索：按用户名或姓名模糊匹配，限制返回条数。供统一搜索（/api/search）复用。 */
    public java.util.List<User> searchByName(String keyword, int limit, String tenantId) {
        if (!org.springframework.util.StringUtils.hasText(keyword)) return java.util.List.of();
        return userMapper.selectList(new LambdaQueryWrapper<User>()
            .eq(User::getTenantId, tenantId)
            .and(w -> w.like(User::getUsername, keyword).or().like(User::getRealName, keyword))
            .last("LIMIT " + limit));
    }

    @Transactional
    public User create(CreateUserRequest req, String tenantId) {
        if (userMapper.findByUsername(req.getUsername()).isPresent()) {
            throw new IllegalArgumentException("用户名已存在");
        }
        User user = new User();
        user.setTenantId(tenantId);
        user.setUsername(req.getUsername());
        user.setPassword(passwordEncoder.encode(req.getPassword()));
        user.setRealName(req.getRealName());
        user.setEmail(req.getEmail());
        user.setGroupId(req.getGroupId());
        user.setStatus(1);
        userMapper.insert(user);
        if (req.getRoleIds() != null && !req.getRoleIds().isEmpty()) {
            rbacService.assignRolesToUser(user.getId(), req.getRoleIds());
        }
        return user;
    }

    @Transactional
    public void update(Long id, UpdateUserRequest req) {
        User user = userMapper.selectById(id);
        if (user == null) throw new IllegalArgumentException("用户不存在");
        if (req.getRealName() != null) user.setRealName(req.getRealName());
        if (req.getEmail() != null) user.setEmail(req.getEmail());
        if (req.getGroupId() != null) user.setGroupId(req.getGroupId());
        if (req.getStatus() != null) user.setStatus(req.getStatus());
        if (req.getPassword() != null) user.setPassword(passwordEncoder.encode(req.getPassword()));
        userMapper.updateById(user);
        if (req.getRoleIds() != null) {
            rbacService.assignRolesToUser(id, req.getRoleIds());
        }
    }

    @Transactional
    public void delete(Long id, Long operatorId) {
        User user = userMapper.selectById(id);
        if (user == null) throw new IllegalArgumentException("用户不存在");
        user.setDeletedBy(operatorId);
        user.setDeletedAt(LocalDateTime.now());
        userMapper.updateById(user);
        userMapper.deleteById(id);
    }
}
