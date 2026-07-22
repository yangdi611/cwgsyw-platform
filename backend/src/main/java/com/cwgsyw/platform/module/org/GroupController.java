package com.cwgsyw.platform.module.org;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.org.dto.GroupMemberVO;
import com.cwgsyw.platform.module.org.dto.GroupMembershipRequest;
import com.cwgsyw.platform.module.org.dto.GroupRequest;
import com.cwgsyw.platform.module.org.dto.GroupLifecycleActionRequest;
import com.cwgsyw.platform.module.org.dto.GroupLifecycleListVO;
import com.cwgsyw.platform.module.org.dto.GroupLifecyclePreflightVO;
import com.cwgsyw.platform.module.org.dto.GroupLifecycleResult;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class GroupController {
    private final GroupMapper groupMapper;
    private final UserMapper userMapper;
    private final AuditLogMapper auditLogMapper;
    private final GroupMembershipService groupMembershipService;
    private final GroupLifecycleService groupLifecycleService;
    private final ActiveGroupReferenceValidator activeGroupReferenceValidator;

    @GetMapping
    @PreAuthorize("hasPermission('group', 'read')")
    public R<List<GroupLifecycleListVO>> list(
            @RequestParam(defaultValue = "active") String state,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(groupLifecycleService.list(state, cu));
    }

    @GetMapping("/{id}/lifecycle-preflight")
    @PreAuthorize("isAuthenticated()")
    public R<GroupLifecyclePreflightVO> lifecyclePreflight(
            @PathVariable Long id,
            @RequestParam String action,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(groupLifecycleService.preflight(id, action, cu));
    }

    @PostMapping("/{id}/archive")
    @PreAuthorize("hasPermission('group', 'delete')")
    public R<GroupLifecycleResult> archive(
            @PathVariable Long id,
            @RequestBody GroupLifecycleActionRequest request,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(groupLifecycleService.archive(id, request, cu));
    }

    @PostMapping("/{id}/restore")
    @PreAuthorize("hasPermission('group', 'update')")
    public R<GroupLifecycleResult> restore(
            @PathVariable Long id,
            @RequestBody GroupLifecycleActionRequest request,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(groupLifecycleService.restore(id, request, cu));
    }

    @PostMapping("/{id}/purge")
    @PreAuthorize("hasPermission('group', 'purge')")
    public R<GroupLifecycleResult> purge(
            @PathVariable Long id,
            @RequestBody GroupLifecycleActionRequest request,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(groupLifecycleService.purge(id, request, cu));
    }

    @PostMapping
    @PreAuthorize("hasPermission('group', 'create')")
    public R<Group> create(@Valid @RequestBody GroupRequest request,
                           @AuthenticationPrincipal SecurityUser cu) {
        String name = request.getName().trim();
        requireUniqueActiveName(cu.getTenantId(), name, null);
        Group group = new Group();
        group.setId(null);
        group.setTenantId(cu.getTenantId());
        group.setName(name);
        group.setDescription(request.getDescription());
        group.setLeaderId(request.getLeaderId());
        group.setCode("group_" + UUID.randomUUID().toString().replace("-", ""));
        group.setGroupType("business");
        group.setIsBuiltin(false);
        groupMapper.insert(group);
        return R.ok(group);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasPermission('group', 'update')")
    public R<Void> update(@PathVariable Long id, @Valid @RequestBody GroupRequest request,
                          @AuthenticationPrincipal SecurityUser cu) {
        Group existing = activeGroupReferenceValidator.lockAndRequire(cu.getTenantId(), id);
        if (Boolean.TRUE.equals(existing.getIsBuiltin())) {
            throw new IllegalArgumentException("内置用户组不能编辑");
        }
        String name = request.getName().trim();
        requireUniqueActiveName(cu.getTenantId(), name, id);
        existing.setName(name);
        existing.setDescription(request.getDescription());
        existing.setLeaderId(request.getLeaderId());
        groupMapper.updateById(existing);
        return R.ok();
    }

    private void requireUniqueActiveName(String tenantId, String name, Long groupId) {
        if (groupMapper.countActiveNameConflict(tenantId, name, groupId) > 0) {
            throw new IllegalArgumentException("用户组名称已存在");
        }
    }

    @GetMapping("/{id}/members")
    @PreAuthorize("hasPermission('group', 'read')")
    public R<List<GroupMemberVO>> getMembers(@PathVariable Long id,
                                              @AuthenticationPrincipal SecurityUser cu) {
        List<User> members = groupMembershipService.findUsersByGroup(id, cu.getTenantId());
        List<GroupMemberVO> vos = members.stream().map(u -> {
            GroupMemberVO vo = new GroupMemberVO();
            vo.setUserId(u.getId());
            vo.setUsername(u.getUsername());
            vo.setRealName(u.getRealName());
            vo.setEmail(u.getEmail());
            vo.setRoleNames(List.of());
            return vo;
        }).collect(Collectors.toList());
        return R.ok(vos);
    }

    @PostMapping("/{id}/members")
    @PreAuthorize("hasPermission('group', 'update')")
    @Transactional
    public R<Void> addMember(@PathVariable Long id,
                              @RequestBody Map<String, Long> body,
                              @AuthenticationPrincipal SecurityUser cu) {
        Long userId = body.get("userId");
        if (userId == null) throw new IllegalArgumentException("userId is required");

        // 不允许自己操作自己
        if (cu.getUserId().equals(userId)) {
            throw new IllegalArgumentException("不能添加或移动自己的组成员关系");
        }

        User user = userMapper.selectById(userId);
        if (user == null) throw new IllegalArgumentException("用户不存在: " + userId);

        GroupMembershipRequest request = new GroupMembershipRequest();
        request.setGroupId(id);
        request.setMembershipRole("member");
        request.setPrimary(user.getGroupId() == null || id.equals(user.getGroupId()));
        groupMembershipService.add(userId, request, cu.getTenantId(), cu.getUserId());
        String beforeJson = "{\"group_id\":" + user.getGroupId() + "}";
        String afterJson = "{\"membership_group_id\":" + id + "}";

        auditLogMapper.insert(AuditLog.builder()
                .tenantId(cu.getTenantId())
                .module("group")
                .action("add_member")
                .targetId(userId)
                .targetType("user")
                .operatorId(cu.getUserId())
                .beforeJson(beforeJson)
                .afterJson(afterJson)
                .remark("添加到组: " + id)
                .build());

        return R.ok();
    }

    @DeleteMapping("/{id}/members/{userId}")
    @PreAuthorize("hasPermission('group', 'update')")
    @Transactional
    public R<Void> removeMember(@PathVariable Long id,
                                 @PathVariable Long userId,
                                 @AuthenticationPrincipal SecurityUser cu) {
        // 不允许自己操作自己
        if (cu.getUserId().equals(userId)) {
            throw new IllegalArgumentException("不能移除自己的组成员关系");
        }

        User user = userMapper.selectById(userId);
        if (user == null) throw new IllegalArgumentException("用户不存在: " + userId);
        String beforeJson = "{\"membership_group_id\":" + id + "}";
        groupMembershipService.removeByGroup(userId, id, cu.getTenantId(), cu.getUserId());

        auditLogMapper.insert(AuditLog.builder()
                .tenantId(cu.getTenantId())
                .module("group")
                .action("remove_member")
                .targetId(userId)
                .targetType("user")
                .operatorId(cu.getUserId())
                .beforeJson(beforeJson)
                .afterJson("{\"group_id\":null}")
                .remark("从组移除: " + id)
                .build());

        return R.ok();
    }
}
