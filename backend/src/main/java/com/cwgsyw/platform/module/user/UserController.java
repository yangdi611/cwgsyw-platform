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

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;

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
}
