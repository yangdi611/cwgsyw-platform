package com.cwgsyw.platform.module.auth;

import com.cwgsyw.platform.module.auth.dto.*;
import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final RbacService rbacService;

    public LoginResponse login(LoginRequest req) {
        User user = userMapper.findByUsername(req.getUsername())
            .orElseThrow(() -> new BadCredentialsException("用户名或密码错误"));
        if (!passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            throw new BadCredentialsException("用户名或密码错误");
        }
        if (user.getStatus() != 1) {
            throw new IllegalArgumentException("账号已禁用");
        }
        Set<String> permissions = rbacService.getUserPermissions(user.getId());
        String token = jwtUtil.generateToken(user.getId(), user.getUsername(), user.getTenantId());
        return new LoginResponse(token, user.getUsername(), user.getRealName(), permissions);
    }
}
