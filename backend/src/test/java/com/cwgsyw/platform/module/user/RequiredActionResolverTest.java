package com.cwgsyw.platform.module.user;

import com.cwgsyw.platform.config.SecurityProperties;
import com.cwgsyw.platform.module.user.entity.User;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * requiredActions 计算规则（SPEC 8.2 / 17.2）。
 * 关键场景：历史用户（mustChangePassword=false，如 superadmin）即使 phone 缺失，
 * 默认也不应被强制 COMPLETE_PROFILE —— 这是一次生产环境真实回归的复现用例：
 * superadmin 登录后被误加 COMPLETE_PROFILE，导致 JwtAuthFilter 拒绝所有业务 API（403）。
 */
class RequiredActionResolverTest {

    private final SecurityProperties securityProperties = new SecurityProperties();
    private final RequiredActionResolver resolver = new RequiredActionResolver(securityProperties);

    private User historicalUser(String email, String phone) {
        User user = new User();
        user.setUsername("superadmin");
        user.setMustChangePassword(false);
        user.setProfileCompleted(false);
        user.setEmail(email);
        user.setPhone(phone);
        return user;
    }

    private User newUser(String email, String phone) {
        User user = new User();
        user.setUsername("testuser");
        user.setMustChangePassword(true);
        user.setProfileCompleted(email != null && phone != null);
        user.setEmail(email);
        user.setPhone(phone);
        return user;
    }

    @Test
    void historicalUser_missingPhone_notForcedToCompleteProfile() {
        // 复现 superadmin 回归：历史用户无 phone，forceExistingUsersCompleteProfile 默认 false
        User user = historicalUser("admin@example.com", null);

        List<String> actions = resolver.resolve(user);

        assertFalse(actions.contains(RequiredActionResolver.COMPLETE_PROFILE));
        assertFalse(actions.contains(RequiredActionResolver.CHANGE_PASSWORD));
        assertTrue(actions.isEmpty());
    }

    @Test
    void historicalUser_missingBothContacts_stillNotForced() {
        User user = historicalUser(null, null);

        List<String> actions = resolver.resolve(user);

        assertTrue(actions.isEmpty());
    }

    @Test
    void historicalUser_whenForceConfigEnabled_isForced() {
        securityProperties.getAccount().setForceExistingUsersCompleteProfile(true);
        User user = historicalUser("admin@example.com", null);

        List<String> actions = resolver.resolve(user);

        assertTrue(actions.contains(RequiredActionResolver.COMPLETE_PROFILE));
    }

    @Test
    void newUser_missingPhone_isForcedToCompleteProfile() {
        User user = newUser("new@example.com", null);

        List<String> actions = resolver.resolve(user);

        assertTrue(actions.contains(RequiredActionResolver.COMPLETE_PROFILE));
    }

    @Test
    void newUser_mustChangePassword_isForced() {
        User user = newUser("new@example.com", "13800138000");
        user.setMustChangePassword(true);

        List<String> actions = resolver.resolve(user);

        assertTrue(actions.contains(RequiredActionResolver.CHANGE_PASSWORD));
        assertFalse(actions.contains(RequiredActionResolver.COMPLETE_PROFILE));
    }

    @Test
    void newUser_completeProfileAndPasswordChanged_noRequiredActions() {
        User user = newUser("new@example.com", "13800138000");
        user.setMustChangePassword(false);

        List<String> actions = resolver.resolve(user);

        assertTrue(actions.isEmpty());
    }

    @Test
    void historicalUser_profileCompletedTrue_notForced() {
        User user = historicalUser("admin@example.com", "13800138000");
        user.setProfileCompleted(true);

        List<String> actions = resolver.resolve(user);

        assertTrue(actions.isEmpty());
    }
}
