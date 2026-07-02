package com.cwgsyw.platform.module.user.password;

/**
 * 密码策略校验失败项（SPEC 9.1 inspect()）。用于前端展示规则命中情况。
 */
public enum PasswordPolicyViolation {
    TOO_SHORT,
    MISSING_UPPER,
    MISSING_LOWER,
    MISSING_DIGIT,
    MISSING_SPECIAL,
    INVALID_CHARACTER,
    CONTAINS_USERNAME
}
