package com.cwgsyw.platform.module.org;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.org.dto.GroupMemberVO;
import com.cwgsyw.platform.module.org.dto.GroupMembershipRequest;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
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

    @GetMapping
    @PreAuthorize("hasPermission('group', 'read')")
    public R<List<Group>> list(@AuthenticationPrincipal SecurityUser cu) {
        return R.ok(groupMapper.selectList(
            new LambdaQueryWrapper<Group>().eq(Group::getTenantId, cu.getTenantId())));
    }

    @PostMapping
    @PreAuthorize("hasPermission('group', 'create')")
    public R<Group> create(@RequestBody Group group,
                           @AuthenticationPrincipal SecurityUser cu) {
        group.setId(null);
        group.setTenantId(cu.getTenantId());
        group.setCode("group_" + UUID.randomUUID().toString().replace("-", ""));
        group.setGroupType("business");
        group.setIsBuiltin(false);
        groupMapper.insert(group);
        return R.ok(group);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasPermission('group', 'update')")
    public R<Void> update(@PathVariable Long id, @RequestBody Group req,
                          @AuthenticationPrincipal SecurityUser cu) {
        Group existing = groupMapper.selectById(id);
        if (existing == null || !cu.getTenantId().equals(existing.getTenantId())) {
            throw new IllegalArgumentException("用户组不存在");
        }
        if (Boolean.TRUE.equals(existing.getIsBuiltin())) {
            throw new IllegalArgumentException("内置用户组不能编辑");
        }
        req.setId(id);
        req.setTenantId(existing.getTenantId());
        req.setCode(existing.getCode());
        req.setGroupType(existing.getGroupType());
        req.setIsBuiltin(existing.getIsBuiltin());
        groupMapper.updateById(req);
        return R.ok();
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
