package com.cwgsyw.platform.module.cmdb.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.notification.NotificationService;
import com.cwgsyw.platform.module.rbac.entity.SysRole;
import com.cwgsyw.platform.module.rbac.entity.SysUserRole;
import com.cwgsyw.platform.module.rbac.SysRoleMapper;
import com.cwgsyw.platform.module.rbac.SysUserRoleMapper;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CiNotificationService {

    private final NotificationService notificationService;
    private final CiInstanceMapper ciInstanceMapper;
    private final UserMapper userMapper;
    private final SysUserRoleMapper sysUserRoleMapper;
    private final SysRoleMapper sysRoleMapper;

    /**
     * CI 实例状态变更时发送通知。
     * 如果新旧状态相同则不发送。
     */
    public void notifyStatusChange(CiInstance instance, String oldStatus, String newStatus, Long operatorId) {
        if (Objects.equals(oldStatus, newStatus)) return;

        List<Long> targets = resolveNotifyTargets(instance, operatorId);
        String tenantId = instance.getTenantId();
        String title = "CI 状态变更: " + instance.getName();
        String content = String.format("CI 实例 [%s] 状态从 %s 变为 %s",
                instance.getName(), oldStatus, newStatus);

        for (Long uid : targets) {
            notificationService.notify(tenantId, uid, title, content,
                    "system", "ci_instance", instance.getId());
        }
    }

    /**
     * CI 实例删除后发送通知。
     */
    public void notifyDelete(CiInstance instance, Long operatorId) {
        String operatorName = "系统";
        if (operatorId != null && operatorId > 0) {
            User operator = userMapper.selectById(operatorId);
            if (operator != null) {
                operatorName = operator.getRealName() != null ? operator.getRealName() : operator.getUsername();
            }
        }

        List<Long> targets = resolveNotifyTargets(instance, operatorId);
        String tenantId = instance.getTenantId();
        String title = "CI 实例已删除: " + instance.getName();
        String content = String.format("CI 实例 [%s] 已被 %s 删除",
                instance.getName(), operatorName);

        for (Long uid : targets) {
            notificationService.notify(tenantId, uid, title, content,
                    "system", "ci_instance", instance.getId());
        }
    }

    /**
     * 解析通知目标用户：
     * 1. CI 的 Owner（如果设置了 owner，根据 username 查找对应用户）
     * 2. 租户管理员（拥有 platform 或 tenant scope 角色的用户）
     * 3. 去重并排除操作者本人
     */
    private List<Long> resolveNotifyTargets(CiInstance instance, Long operatorId) {
        Set<Long> targetIds = new LinkedHashSet<>();

        // 1. Owner
        if (instance.getOwner() != null && !instance.getOwner().isBlank()) {
            userMapper.findByUsername(instance.getOwner())
                    .ifPresent(u -> targetIds.add(u.getId()));
        }

        // 2. 管理员用户（platform / tenant scope 角色）
        List<Long> adminRoleIds = sysRoleMapper.selectList(
                new LambdaQueryWrapper<SysRole>()
                        .in(SysRole::getScope, List.of("platform", "tenant"))
                        .eq(SysRole::getIsDeleted, false)
        ).stream().map(SysRole::getId).collect(Collectors.toList());

        if (!adminRoleIds.isEmpty()) {
            List<Long> adminUserIds = sysUserRoleMapper.findUserIdsByRoleIds(adminRoleIds);
            targetIds.addAll(adminUserIds);
        }

        // 3. 排除操作者
        targetIds.remove(operatorId);

        return new ArrayList<>(targetIds);
    }
}
