package com.cwgsyw.platform.module.auth;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.auth.dto.*;
import com.cwgsyw.platform.module.auth.session.AuthSessionRecord;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;

    @PostMapping("/login")
    public R<LoginResponse> login(@Valid @RequestBody LoginRequest req, HttpServletRequest request) {
        return R.ok(authService.login(req, request.getHeader("User-Agent"), request.getRemoteAddr()));
    }

    @PostMapping("/logout")
    public R<Void> logout() {
        authService.logout();
        return R.ok();
    }

    @PostMapping("/session/touch")
    public R<SessionTouchResponse> touch() {
        return R.ok(authService.touch());
    }

    @GetMapping("/session/current")
    public R<AuthSessionRecord> current() {
        return R.ok(authService.currentSession());
    }

    @ExceptionHandler(BadCredentialsException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public R<Void> handleBadCredentials(BadCredentialsException ex) {
        return R.fail(401, ex.getMessage());
    }
}
