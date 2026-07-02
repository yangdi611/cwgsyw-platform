package com.cwgsyw.platform.module.account;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.account.dto.*;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * 当前登录用户自助资料/改密/首次登录 setup 入口（SPEC 11.2）。
 * 这些路径在 requiredActions 非空时也必须可访问，见 JwtAuthFilter 白名单（SPEC 14）。
 */
@RestController
@RequestMapping("/api/account")
@RequiredArgsConstructor
public class AccountController {
    private final AccountService accountService;

    @GetMapping("/profile")
    public R<AccountProfileResponse> getProfile(@AuthenticationPrincipal SecurityUser currentUser) {
        return R.ok(accountService.getProfile(currentUser.getUserId()));
    }

    @PutMapping("/profile")
    public R<AccountProfileResponse> updateProfile(@Valid @RequestBody UpdateAccountProfileRequest req,
                                                    @AuthenticationPrincipal SecurityUser currentUser) {
        return R.ok(accountService.updateProfile(currentUser.getUserId(), req));
    }

    @PostMapping("/password")
    public R<AccountProfileResponse> changePassword(@Valid @RequestBody ChangePasswordRequest req,
                                                     @AuthenticationPrincipal SecurityUser currentUser) {
        return R.ok(accountService.changePassword(currentUser.getUserId(), req));
    }

    @PostMapping("/setup")
    public R<AccountProfileResponse> setup(@Valid @RequestBody AccountSetupRequest req,
                                           @AuthenticationPrincipal SecurityUser currentUser) {
        return R.ok(accountService.setup(currentUser.getUserId(), req));
    }
}
