package com.cwgsyw.platform.security;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.common.SecurityErrorCode;
import com.cwgsyw.platform.module.auth.session.AuthSessionService;
import com.cwgsyw.platform.module.auth.session.AuthSessionStatus;
import com.cwgsyw.platform.module.auth.session.SessionValidationResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * JWT 签名校验通过后，还必须校验 Redis 中的可撤销会话（SPEC 10.5），
 * 并对未完成首次登录 setup 的用户执行业务路径白名单（SPEC 14）。
 * 不在此处 touch 会话，touch 只由前端真实交互显式调用 /api/auth/session/touch。
 */
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {
    private final JwtUtil jwtUtil;
    private final UserDetailsServiceImpl userDetailsService;
    private final AuthSessionService authSessionService;
    private final ObjectMapper objectMapper;

    /** 未完成首次登录 setup 的用户，只允许访问这些路径（SPEC 14 白名单）。 */
    private static final List<String> REQUIRED_ACTION_WHITELIST = List.of(
        "/api/account/profile",
        "/api/account/password",
        "/api/account/setup",
        "/api/auth/logout",
        "/api/auth/session/touch",
        "/api/auth/session/current",
        "/actuator/health"
    );

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res,
                                    FilterChain chain) throws ServletException, IOException {
        String token = extractToken(req);
        if (StringUtils.hasText(token) && jwtUtil.validateToken(token)) {
            String sessionId = jwtUtil.getSessionId(token);
            if (!StringUtils.hasText(sessionId)) {
                // 旧 token（上线前签发，无 sessionId）一律拒绝，要求重新登录（SPEC 17.1）
                writeError(res, 401, SecurityErrorCode.SESSION_INVALID, "登录状态已失效，请重新登录");
                return;
            }

            Long tokenUserId = jwtUtil.getUserId(token);
            SessionValidationResult validation;
            try {
                validation = authSessionService.validate(sessionId, tokenUserId);
            } catch (Exception e) {
                writeError(res, 503, SecurityErrorCode.SESSION_STORE_UNAVAILABLE, "系统认证服务暂不可用，请稍后重试");
                return;
            }

            if (validation.getStatus() == AuthSessionStatus.STORE_UNAVAILABLE) {
                writeError(res, 503, SecurityErrorCode.SESSION_STORE_UNAVAILABLE, "系统认证服务暂不可用，请稍后重试");
                return;
            }
            if (validation.getStatus() == AuthSessionStatus.REVOKED) {
                writeError(res, 401, SecurityErrorCode.SESSION_REVOKED, "登录状态已被撤销，请重新登录");
                return;
            }
            if (validation.getStatus() == AuthSessionStatus.TIMEOUT) {
                writeError(res, 401, SecurityErrorCode.SESSION_TIMEOUT, "登录已超时，请重新登录");
                return;
            }
            if (validation.getStatus() != AuthSessionStatus.VALID) {
                writeError(res, 401, SecurityErrorCode.SESSION_INVALID, "登录状态已失效，请重新登录");
                return;
            }

            String username = jwtUtil.getUsername(token);
            SecurityUser userDetails;
            try {
                userDetails = (SecurityUser) userDetailsService.loadUserByUsername(username);
            } catch (Exception e) {
                authSessionService.revoke(sessionId, null, "USER_NOT_FOUND");
                writeError(res, 401, SecurityErrorCode.SESSION_INVALID, "登录状态已失效，请重新登录");
                return;
            }
            userDetails.setSessionId(sessionId);

            List<String> requiredActions = userDetails.getRequiredActions();
            if (!requiredActions.isEmpty() && !isWhitelisted(req)) {
                String errorCode = requiredActions.contains("CHANGE_PASSWORD")
                    ? SecurityErrorCode.PASSWORD_CHANGE_REQUIRED
                    : SecurityErrorCode.PROFILE_REQUIRED;
                String message = requiredActions.contains("CHANGE_PASSWORD")
                    ? "请先修改初始密码" : "请先完善个人资料";
                writeError(res, 403, errorCode, message);
                return;
            }

            var auth = new UsernamePasswordAuthenticationToken(
                userDetails, null, userDetails.getAuthorities());
            SecurityContextHolder.getContext().setAuthentication(auth);
        }
        chain.doFilter(req, res);
    }

    private boolean isWhitelisted(HttpServletRequest req) {
        String path = req.getRequestURI();
        return REQUIRED_ACTION_WHITELIST.stream().anyMatch(path::equals);
    }

    private String extractToken(HttpServletRequest req) {
        String bearer = req.getHeader("Authorization");
        if (StringUtils.hasText(bearer) && bearer.startsWith("Bearer ")) {
            return bearer.substring(7);
        }
        return null;
    }

    private void writeError(HttpServletResponse res, int httpStatus, String errorCode, String message) throws IOException {
        res.setStatus(httpStatus);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.setCharacterEncoding(StandardCharsets.UTF_8.name());
        R<Void> body = R.fail(httpStatus, errorCode, message);
        res.getWriter().write(objectMapper.writeValueAsString(body));
    }
}
