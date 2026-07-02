package com.cwgsyw.platform.module.auth.session;

/** 可撤销会话校验结果状态（SPEC 10.4）。 */
public enum AuthSessionStatus {
    VALID,
    INVALID,
    REVOKED,
    TIMEOUT,
    STORE_UNAVAILABLE
}
