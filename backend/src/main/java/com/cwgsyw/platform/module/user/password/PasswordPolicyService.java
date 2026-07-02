package com.cwgsyw.platform.module.user.password;

import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.SecurityErrorCode;
import com.cwgsyw.platform.config.SecurityProperties;
import com.cwgsyw.platform.module.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * 密码复杂度 + 用户名包含校验（SPEC 9.1-9.2）。
 * 不做密码历史校验，历史校验由 {@link PasswordHistoryService} 负责。
 */
@Service
@RequiredArgsConstructor
public class PasswordPolicyService {

    private final SecurityProperties securityProperties;

    /** 强制校验，任一规则不满足即抛 {@link BusinessException}。 */
    public void validateNewPassword(User user, String newPassword) {
        String username = user != null ? user.getUsername() : null;
        validateNewPassword(username, newPassword);
    }

    public void validateNewPassword(String username, String newPassword) {
        List<PasswordPolicyViolation> violations = inspect(username, newPassword);
        if (!violations.isEmpty()) {
            if (violations.contains(PasswordPolicyViolation.CONTAINS_USERNAME)) {
                throw new BusinessException(400, SecurityErrorCode.PASSWORD_CONTAINS_USERNAME, "密码不能包含用户名");
            }
            throw new BusinessException(400, SecurityErrorCode.PASSWORD_POLICY_VIOLATION, "密码不符合复杂度要求");
        }
    }

    public void validateConfirmation(String newPassword, String confirmPassword) {
        if (newPassword == null || !newPassword.equals(confirmPassword)) {
            throw new BusinessException(400, SecurityErrorCode.PASSWORD_CONFIRM_MISMATCH, "两次输入的密码不一致");
        }
    }

    public boolean containsUsername(String username, String newPassword) {
        if (!StringUtils.hasText(username) || !StringUtils.hasText(newPassword)) {
            return false;
        }
        return newPassword.toLowerCase().contains(username.toLowerCase());
    }

    /** 返回所有未通过的规则项，供前端展示或后端强制校验复用。 */
    public List<PasswordPolicyViolation> inspect(String username, String newPassword) {
        List<PasswordPolicyViolation> violations = new ArrayList<>();
        SecurityProperties.Password cfg = securityProperties.getPassword();

        if (newPassword == null || newPassword.length() < cfg.getMinLength()) {
            violations.add(PasswordPolicyViolation.TOO_SHORT);
        }
        if (newPassword == null) {
            return violations;
        }

        String allowedSpecials = cfg.getAllowedSpecials();
        String allowedPattern = "^[A-Za-z0-9" + Pattern.quote(allowedSpecials) + "]+$";
        if (!newPassword.matches(allowedPattern)) {
            violations.add(PasswordPolicyViolation.INVALID_CHARACTER);
        }
        if (cfg.isRequireUpper() && !newPassword.matches(".*[A-Z].*")) {
            violations.add(PasswordPolicyViolation.MISSING_UPPER);
        }
        if (cfg.isRequireLower() && !newPassword.matches(".*[a-z].*")) {
            violations.add(PasswordPolicyViolation.MISSING_LOWER);
        }
        if (cfg.isRequireDigit() && !newPassword.matches(".*[0-9].*")) {
            violations.add(PasswordPolicyViolation.MISSING_DIGIT);
        }
        if (cfg.isRequireSpecial()) {
            String specialPattern = ".*[" + Pattern.quote(allowedSpecials) + "].*";
            if (!newPassword.matches(specialPattern)) {
                violations.add(PasswordPolicyViolation.MISSING_SPECIAL);
            }
        }
        if (cfg.isRejectUsernameContained() && containsUsername(username, newPassword)) {
            violations.add(PasswordPolicyViolation.CONTAINS_USERNAME);
        }
        return violations;
    }
}
