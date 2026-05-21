package com.cwgsyw.platform.module.user;

import com.cwgsyw.platform.common.*;
import com.cwgsyw.platform.module.user.dto.*;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

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
            @AuthenticationPrincipal SecurityUser currentUser) {
        return R.ok(userService.list(page, size, currentUser.getTenantId()));
    }

    @PostMapping
    @PreAuthorize("hasPermission('user', 'create')")
    public R<User> create(@Valid @RequestBody CreateUserRequest req,
                          @AuthenticationPrincipal SecurityUser currentUser) {
        return R.ok(userService.create(req, currentUser.getTenantId()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasPermission('user', 'update')")
    public R<Void> update(@PathVariable Long id, @RequestBody UpdateUserRequest req) {
        userService.update(id, req);
        return R.ok();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasPermission('user', 'delete')")
    public R<Void> delete(@PathVariable Long id,
                          @AuthenticationPrincipal SecurityUser currentUser) {
        userService.delete(id, currentUser.getUserId());
        return R.ok();
    }
}
