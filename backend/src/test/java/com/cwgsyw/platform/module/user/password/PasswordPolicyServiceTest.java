package com.cwgsyw.platform.module.user.password;

import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.SecurityErrorCode;
import com.cwgsyw.platform.config.SecurityProperties;
import com.cwgsyw.platform.module.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 密码复杂度 + 用户名包含校验（SPEC 18.1 第1-7点）。
 */
class PasswordPolicyServiceTest {

    private PasswordPolicyService service;

    @BeforeEach
    void setUp() {
        SecurityProperties properties = new SecurityProperties();
        service = new PasswordPolicyService(properties);
    }

    private User user(String username) {
        User u = new User();
        u.setUsername(username);
        return u;
    }

    @Test
    void tooShort_fails() {
        BusinessException ex = assertThrows(BusinessException.class,
            () -> service.validateNewPassword(user("zhangsan"), "Ab1!aaa"));
        assertEquals(SecurityErrorCode.PASSWORD_POLICY_VIOLATION, ex.getErrorCode());
    }

    @Test
    void missingUpper_fails() {
        BusinessException ex = assertThrows(BusinessException.class,
            () -> service.validateNewPassword(user("zhangsan"), "lowercase1!23"));
        assertEquals(SecurityErrorCode.PASSWORD_POLICY_VIOLATION, ex.getErrorCode());
    }

    @Test
    void missingLower_fails() {
        BusinessException ex = assertThrows(BusinessException.class,
            () -> service.validateNewPassword(user("zhangsan"), "UPPERCASE1!23"));
        assertEquals(SecurityErrorCode.PASSWORD_POLICY_VIOLATION, ex.getErrorCode());
    }

    @Test
    void missingDigit_fails() {
        BusinessException ex = assertThrows(BusinessException.class,
            () -> service.validateNewPassword(user("zhangsan"), "NoDigitsHere!"));
        assertEquals(SecurityErrorCode.PASSWORD_POLICY_VIOLATION, ex.getErrorCode());
    }

    @Test
    void missingSpecial_fails() {
        BusinessException ex = assertThrows(BusinessException.class,
            () -> service.validateNewPassword(user("zhangsan"), "NoSpecial1234"));
        assertEquals(SecurityErrorCode.PASSWORD_POLICY_VIOLATION, ex.getErrorCode());
    }

    @Test
    void disallowedSpecialCharacter_fails() {
        // '$' 不在白名单 !@#%*?_- 中
        BusinessException ex = assertThrows(BusinessException.class,
            () -> service.validateNewPassword(user("zhangsan"), "Passw0rd$123"));
        assertEquals(SecurityErrorCode.PASSWORD_POLICY_VIOLATION, ex.getErrorCode());
    }

    @Test
    void containsUsername_fails() {
        BusinessException ex = assertThrows(BusinessException.class,
            () -> service.validateNewPassword(user("zhangsan"), "Zhangsan@123"));
        assertEquals(SecurityErrorCode.PASSWORD_CONTAINS_USERNAME, ex.getErrorCode());
    }

    @Test
    void containsUsername_caseInsensitive_fails() {
        assertTrue(service.containsUsername("ops_admin", "MyOps_Admin#9"));
    }

    @Test
    void validPassword_passes() {
        assertDoesNotThrow(() -> service.validateNewPassword(user("li.si"), "SafePwd#2026"));
    }

    @Test
    void confirmMismatch_fails() {
        BusinessException ex = assertThrows(BusinessException.class,
            () -> service.validateConfirmation("SafePwd#2026", "Other#2026"));
        assertEquals(SecurityErrorCode.PASSWORD_CONFIRM_MISMATCH, ex.getErrorCode());
    }

    @Test
    void confirmMatch_passes() {
        assertDoesNotThrow(() -> service.validateConfirmation("SafePwd#2026", "SafePwd#2026"));
    }
}
