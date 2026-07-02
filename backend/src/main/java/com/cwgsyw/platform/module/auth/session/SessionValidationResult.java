package com.cwgsyw.platform.module.auth.session;

import lombok.AllArgsConstructor;
import lombok.Data;

/** {@link AuthSessionService#validate} 的返回值，携带校验状态和（若有效）会话记录。 */
@Data
@AllArgsConstructor
public class SessionValidationResult {
    private AuthSessionStatus status;
    private AuthSessionRecord session;

    public static SessionValidationResult valid(AuthSessionRecord session) {
        return new SessionValidationResult(AuthSessionStatus.VALID, session);
    }

    public static SessionValidationResult of(AuthSessionStatus status) {
        return new SessionValidationResult(status, null);
    }

    public static SessionValidationResult of(AuthSessionStatus status, AuthSessionRecord session) {
        return new SessionValidationResult(status, session);
    }

    public boolean isValid() {
        return status == AuthSessionStatus.VALID;
    }
}
