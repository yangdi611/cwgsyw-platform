package com.cwgsyw.platform.module.auth;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.auth.dto.LoginRequest;
import com.cwgsyw.platform.module.auth.session.AuthSessionService;
import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.user.RequiredActionResolver;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceTest {
    @Test
    void invalidCredentialsWriteGenericFailedLoginAudit() {
        UserMapper userMapper = mock(UserMapper.class);
        AuthAuditService authAuditService = mock(AuthAuditService.class);
        when(userMapper.findByUsername("missing-user")).thenReturn(Optional.empty());
        AuthService service = service(userMapper, authAuditService);
        LoginRequest request = new LoginRequest();
        request.setUsername("missing-user");
        request.setPassword("not-recorded");

        assertThrows(BadCredentialsException.class,
            () -> service.login(request, "test-agent", "127.0.0.1"));

        verify(authAuditService).recordFailedLogin(null, "127.0.0.1", "default", "用户名或密码错误");
    }

    @Test
    void validationFailureWritesGenericFailedLoginAudit() {
        AuthAuditService authAuditService = mock(AuthAuditService.class);
        AuthService service = service(mock(UserMapper.class), authAuditService);

        service.recordFailedLoginValidation("127.0.0.1");

        verify(authAuditService).recordFailedLogin(null, "127.0.0.1", "default", "登录请求校验失败");
    }

    private AuthService service(UserMapper userMapper, AuthAuditService authAuditService) {
        return new AuthService(userMapper, mock(PasswordEncoder.class), mock(JwtUtil.class),
            mock(RbacService.class), mock(AuthSessionService.class), mock(RequiredActionResolver.class),
            mock(AuditLogMapper.class), authAuditService);
    }
}
