package com.cwgsyw.platform.module.user;

import com.cwgsyw.platform.common.*;
import com.cwgsyw.platform.module.auth.session.AuthSessionRecord;
import com.cwgsyw.platform.module.user.dto.*;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import com.cwgsyw.platform.module.org.GroupMembershipService;
import com.cwgsyw.platform.module.org.dto.GroupMembershipRequest;
import com.cwgsyw.platform.module.org.dto.UserGroupMembershipVO;
import com.cwgsyw.platform.module.rbac.RoleAssignmentService;
import com.cwgsyw.platform.module.rbac.dto.RoleAssignmentRequest;
import com.cwgsyw.platform.module.rbac.dto.RoleAssignmentVO;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;
    private final GroupMembershipService groupMembershipService;
    private final RoleAssignmentService roleAssignmentService;

    @GetMapping
    @PreAuthorize("hasPermission('user', 'read')")
    public R<PageResult<User>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String keyword,
            @AuthenticationPrincipal SecurityUser currentUser) {
        return R.ok(userService.list(page, size, currentUser.getTenantId(), keyword));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasPermission('user', 'read')")
    public R<UserDetailVO> getDetail(@PathVariable Long id,
                                     @AuthenticationPrincipal SecurityUser currentUser) {
        return R.ok(userService.getDetail(id, currentUser.getTenantId()));
    }

    @PostMapping
    @PreAuthorize("hasPermission('user', 'create')")
    public R<User> create(@Valid @RequestBody CreateUserRequest req,
                          @AuthenticationPrincipal SecurityUser currentUser) {
        return R.ok(userService.create(req, currentUser.getTenantId(), currentUser.getUserId()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasPermission('user', 'update')")
    public R<Void> update(@PathVariable Long id, @RequestBody UpdateUserRequest req,
                          @AuthenticationPrincipal SecurityUser currentUser) {
        userService.update(id, req, currentUser.getUserId());
        return R.ok();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasPermission('user', 'delete')")
    public R<Void> delete(@PathVariable Long id,
                          @AuthenticationPrincipal SecurityUser currentUser) {
        userService.delete(id, currentUser.getUserId());
        return R.ok();
    }

    /** 管理员重置密码（SPEC 11.3）：不需要当前密码，强制下次登录改密并撤销该用户所有会话。 */
    @PostMapping("/{id}/reset-password")
    @PreAuthorize("hasPermission('user', 'update')")
    public R<Void> resetPassword(@PathVariable Long id, @Valid @RequestBody ResetPasswordRequest req,
                                 @AuthenticationPrincipal SecurityUser currentUser) {
        userService.resetPassword(id, req, currentUser.getUserId());
        return R.ok();
    }

    /** 管理员强制下线（SPEC 11.3）。 */
    @PostMapping("/{id}/sessions/revoke")
    @PreAuthorize("hasPermission('user', 'update')")
    public R<Void> revokeSessions(@PathVariable Long id, @AuthenticationPrincipal SecurityUser currentUser) {
        userService.revokeSessions(id, currentUser.getUserId());
        return R.ok();
    }

    /** 第一阶段返回 Redis 中当前 session 摘要，暂无前端 UI（SPEC 3.2 / 11.3）。 */
    @GetMapping("/{id}/sessions")
    @PreAuthorize("hasPermission('user', 'read')")
    public R<List<AuthSessionRecord>> listSessions(@PathVariable Long id) {
        return R.ok(userService.listSessions(id));
    }

    @GetMapping("/{id}/group-memberships")
    @PreAuthorize("hasPermission('group', 'read')")
    public R<List<UserGroupMembershipVO>> listMemberships(
            @PathVariable Long id, @AuthenticationPrincipal SecurityUser currentUser) {
        return R.ok(groupMembershipService.list(id, currentUser.getTenantId()));
    }

    @PostMapping("/{id}/group-memberships")
    @PreAuthorize("hasPermission('group', 'update')")
    public R<Void> addMembership(@PathVariable Long id,
                                 @Valid @RequestBody GroupMembershipRequest request,
                                 @AuthenticationPrincipal SecurityUser currentUser) {
        groupMembershipService.add(id, request, currentUser.getTenantId(), currentUser.getUserId());
        return R.ok();
    }

    @DeleteMapping("/{id}/group-memberships/{membershipId}")
    @PreAuthorize("hasPermission('group', 'update')")
    public R<Void> removeMembership(@PathVariable Long id, @PathVariable Long membershipId,
                                    @AuthenticationPrincipal SecurityUser currentUser) {
        groupMembershipService.remove(id, membershipId, currentUser.getTenantId(), currentUser.getUserId());
        return R.ok();
    }

    @GetMapping("/{id}/role-assignments")
    @PreAuthorize("hasPermission('role', 'read')")
    public R<List<RoleAssignmentVO>> listRoleAssignments(
            @PathVariable Long id, @AuthenticationPrincipal SecurityUser currentUser) {
        return R.ok(roleAssignmentService.list(id, currentUser.getTenantId()));
    }

    @PostMapping("/{id}/role-assignments")
    @PreAuthorize("hasPermission('role', 'assign')")
    public R<Void> addRoleAssignment(@PathVariable Long id,
                                     @Valid @RequestBody RoleAssignmentRequest request,
                                     @AuthenticationPrincipal SecurityUser currentUser) {
        roleAssignmentService.add(id, request, currentUser.getTenantId(), currentUser.getUserId(),
            currentUser.getPermissions(), currentUser.getGroupScope(), currentUser.getGroupId());
        return R.ok();
    }

    @DeleteMapping("/{id}/role-assignments/{assignmentId}")
    @PreAuthorize("hasPermission('role', 'assign')")
    public R<Void> removeRoleAssignment(@PathVariable Long id, @PathVariable Long assignmentId,
                                        @AuthenticationPrincipal SecurityUser currentUser) {
        roleAssignmentService.remove(id, assignmentId, currentUser.getTenantId(), currentUser.getUserId());
        return R.ok();
    }
}
