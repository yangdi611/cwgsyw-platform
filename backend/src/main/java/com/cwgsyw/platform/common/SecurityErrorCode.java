package com.cwgsyw.platform.common;

/**
 * 账号安全相关业务错误码（SPEC 9.5 / 10.4 / 14）。
 * 前端据此文案化并决定是否跳登录。字符串值即 R.errorCode。
 */
public final class SecurityErrorCode {
    private SecurityErrorCode() {}

    // 密码策略（HTTP 400）
    public static final String PASSWORD_CONFIRM_MISMATCH  = "PASSWORD_CONFIRM_MISMATCH";
    public static final String PASSWORD_POLICY_VIOLATION  = "PASSWORD_POLICY_VIOLATION";
    public static final String PASSWORD_CONTAINS_USERNAME = "PASSWORD_CONTAINS_USERNAME";
    public static final String PASSWORD_REUSED            = "PASSWORD_REUSED";
    public static final String CURRENT_PASSWORD_INVALID   = "CURRENT_PASSWORD_INVALID";

    // 会话（HTTP 401 / 503）
    public static final String SESSION_INVALID           = "SESSION_INVALID";
    public static final String SESSION_TIMEOUT           = "SESSION_TIMEOUT";
    public static final String SESSION_REVOKED           = "SESSION_REVOKED";
    public static final String SESSION_STORE_UNAVAILABLE = "SESSION_STORE_UNAVAILABLE";

    // 强制流程守卫（HTTP 403）
    public static final String PASSWORD_CHANGE_REQUIRED = "PASSWORD_CHANGE_REQUIRED";
    public static final String PROFILE_REQUIRED         = "PROFILE_REQUIRED";

    // 资料校验（HTTP 400）
    public static final String EMAIL_ALREADY_USED = "EMAIL_ALREADY_USED";
    public static final String PROFILE_INVALID    = "PROFILE_INVALID";
}
