package com.cwgsyw.platform.module.org;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.org.dto.CreateGroupRequest;
import com.cwgsyw.platform.module.org.dto.GroupListVO;
import com.cwgsyw.platform.module.org.dto.GroupMemberVO;
import com.cwgsyw.platform.module.org.dto.UpdateGroupRequest;
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
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class GroupController {
    private final GroupMapper groupMapper;
    private final UserMapper userMapper;
    private final AuditLogMapper auditLogMapper;

    @GetMapping
    @PreAuthorize("hasPermission('group', 'read')")
    public R<List<GroupListVO>> list(@AuthenticationPrincipal SecurityUser cu) {
        List<Group> groups = groupMapper.selectList(
            new LambdaQueryWrapper<Group>().eq(Group::getTenantId, cu.getTenantId()));

        // Batch load leader realNames
        Set<Long> leaderIds = groups.stream()
            .map(Group::getLeaderId)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
        Map<Long, String> leaderNameMap = leaderIds.isEmpty() ? Map.of() :
            userMapper.selectBatchIds(leaderIds).stream()
                .collect(Collectors.toMap(User::getId, User::getRealName));

        List<GroupListVO> vos = groups.stream().map(g -> {
            GroupListVO vo = new GroupListVO();
            vo.setId(g.getId());
            vo.setName(g.getName());
            vo.setDescription(g.getDescription());
            vo.setLeaderId(g.getLeaderId());
            vo.setLeaderRealName(g.getLeaderId() != null ? leaderNameMap.get(g.getLeaderId()) : null);

            // Count members
            Long count = userMapper.selectCount(
                new LambdaQueryWrapper<User>().eq(User::getGroupId, g.getId()));
            vo.setMemberCount(count.intValue());

            // Top 3 member preview (exclude leader)
            List<String> preview = userMapper.selectList(
                new LambdaQueryWrapper<User>()
                    .eq(User::getGroupId, g.getId())
                    .ne(g.getLeaderId() != null, User::getId, g.getLeaderId())
                    .last("LIMIT 3")
            ).stream().map(User::getRealName).collect(Collectors.toList());
            vo.setMemberPreview(preview);

            return vo;
        }).collect(Collectors.toList());

        return R.ok(vos);
    }

    @PostMapping
    @PreAuthorize("hasPermission('group', 'create')")
    @Transactional
    public R<Group> create(@RequestBody CreateGroupRequest req,
                           @AuthenticationPrincipal SecurityUser cu) {
        // 1. Create Group entity
        Group group = new Group();
        group.setName(req.getName());
        group.setDescription(req.getDescription());
        group.setLeaderId(req.getLeaderId());
        group.setTenantId(cu.getTenantId());
        groupMapper.insert(group);

        // 2. Assign leader if specified
        if (req.getLeaderId() != null) {
            User user = userMapper.selectById(req.getLeaderId());
            String beforeJson = user != null ? "{\"group_id\":" + user.getGroupId() + "}" : null;

            userMapper.update(null,
                new LambdaUpdateWrapper<User>()
                    .eq(User::getId, req.getLeaderId())
                    .set(User::getGroupId, group.getId()));

            auditLogMapper.insert(AuditLog.builder()
                .tenantId(cu.getTenantId())
                .module("group")
                .action("add_member")
                .targetId(req.getLeaderId())
                .targetType("user")
                .operatorId(cu.getUserId())
                .beforeJson(beforeJson)
                .afterJson("{\"group_id\":" + group.getId() + "}")
                .remark("创建组时设为组长: " + group.getName())
                .build());
        }

        // 3. Assign members
        if (req.getMemberIds() != null) {
            for (Long memberId : req.getMemberIds()) {
                if (Objects.equals(memberId, req.getLeaderId())) continue; // already assigned as leader
                User user = userMapper.selectById(memberId);
                String beforeJson = user != null ? "{\"group_id\":" + user.getGroupId() + "}" : null;

                userMapper.update(null,
                    new LambdaUpdateWrapper<User>()
                        .eq(User::getId, memberId)
                        .set(User::getGroupId, group.getId()));

                auditLogMapper.insert(AuditLog.builder()
                    .tenantId(cu.getTenantId())
                    .module("group")
                    .action("add_member")
                    .targetId(memberId)
                    .targetType("user")
                    .operatorId(cu.getUserId())
                    .beforeJson(beforeJson)
                    .afterJson("{\"group_id\":" + group.getId() + "}")
                    .remark("创建组时添加成员: " + group.getName())
                    .build());
            }
        }

        return R.ok(group);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasPermission('group', 'update')")
    @Transactional
    public R<Void> update(@PathVariable Long id,
                          @RequestBody UpdateGroupRequest req,
                          @AuthenticationPrincipal SecurityUser cu) {
        Group existing = groupMapper.selectById(id);
        if (existing == null) throw new IllegalArgumentException("组不存在: " + id);

        String beforeJson = "{\"name\":\"" + existing.getName() + "\",\"description\":\"" + existing.getDescription() + "\",\"leader_id\":" + existing.getLeaderId() + "}";

        if (req.getName() != null) existing.setName(req.getName());
        if (req.getDescription() != null) existing.setDescription(req.getDescription());
        existing.setLeaderId(req.getLeaderId());

        groupMapper.updateById(existing);

        String afterJson = "{\"name\":\"" + existing.getName() + "\",\"description\":\"" + existing.getDescription() + "\",\"leader_id\":" + existing.getLeaderId() + "}";

        auditLogMapper.insert(AuditLog.builder()
            .tenantId(cu.getTenantId())
            .module("group")
            .action("update")
            .targetId(id)
            .targetType("group")
            .operatorId(cu.getUserId())
            .beforeJson(beforeJson)
            .afterJson(afterJson)
            .remark("编辑组: " + existing.getName())
            .build());

        return R.ok();
    }

    @GetMapping("/{id}/members")
    @PreAuthorize("hasPermission('group', 'read')")
    public R<List<GroupMemberVO>> getMembers(@PathVariable Long id,
                                              @AuthenticationPrincipal SecurityUser cu) {
        List<User> members = userMapper.selectList(
            new LambdaQueryWrapper<User>()
                .eq(User::getTenantId, cu.getTenantId())
                .eq(User::getGroupId, id));
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

        String beforeJson = "{\"group_id\":" + user.getGroupId() + "}";
        user.setGroupId(id);
        userMapper.updateById(user);
        String afterJson = "{\"group_id\":" + id + "}";

        // 审计日志
        AuditLog log = AuditLog.builder()
                .tenantId(cu.getTenantId())
                .module("group")
                .action("add_member")
                .targetId(userId)
                .targetType("user")
                .operatorId(cu.getUserId())
                .beforeJson(beforeJson)
                .afterJson(afterJson)
                .remark("添加到组: " + id)
                .build();
        auditLogMapper.insert(log);

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
        if (!id.equals(user.getGroupId())) {
            throw new IllegalArgumentException("用户不在当前组中");
        }

        String beforeJson = "{\"group_id\":" + user.getGroupId() + "}";
        userMapper.update(null,
            new LambdaUpdateWrapper<User>()
                .eq(User::getId, userId)
                .set(User::getGroupId, null));
        user.setGroupId(null);

        // 审计日志
        AuditLog log = AuditLog.builder()
                .tenantId(cu.getTenantId())
                .module("group")
                .action("remove_member")
                .targetId(userId)
                .targetType("user")
                .operatorId(cu.getUserId())
                .beforeJson(beforeJson)
                .afterJson("{\"group_id\":null}")
                .remark("从组移除: " + id)
                .build();
        auditLogMapper.insert(log);

        return R.ok();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasPermission('group', 'delete')")
    @Transactional
    public R<Void> delete(@PathVariable Long id,
                          @AuthenticationPrincipal SecurityUser cu) {
        Group group = groupMapper.selectById(id);
        if (group == null) throw new IllegalArgumentException("组不存在: " + id);

        // Clear group_id for all members in this group
        userMapper.update(null,
            new LambdaUpdateWrapper<User>()
                .eq(User::getGroupId, id)
                .set(User::getGroupId, null));

        groupMapper.deleteById(id);

        auditLogMapper.insert(AuditLog.builder()
            .tenantId(cu.getTenantId())
            .module("group")
            .action("delete")
            .targetId(id)
            .targetType("group")
            .operatorId(cu.getUserId())
            .beforeJson("{\"name\":\"" + group.getName() + "\"}")
            .afterJson(null)
            .remark("删除组: " + group.getName())
            .build());

        return R.ok();
    }
}
