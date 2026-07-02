package com.cwgsyw.platform.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 账号安全相关配置（SPEC 6.2）。前缀 security，字段 camelCase。
 */
@Data
@Component
@ConfigurationProperties(prefix = "security")
public class SecurityProperties {
    private Account account = new Account();
    private Session session = new Session();
    private Password password = new Password();

    @Data
    public static class Account {
        /** 是否强制历史用户补全个人资料 */
        private boolean forceExistingUsersCompleteProfile = false;
    }

    @Data
    public static class Session {
        /** 无操作超时（分钟），超过则会话失效 */
        private long idleTimeoutMinutes = 60;
        /** 前端 touch 节流（分钟） */
        private long touchThrottleMinutes = 5;
        /** Redis TTL 相对 JWT 过期额外缓冲（分钟） */
        private long redisTtlBufferMinutes = 10;
    }

    @Data
    public static class Password {
        private int minLength = 10;
        private int historyCount = 5;
        private String allowedSpecials = "!@#%*?_-";
        private boolean requireUpper = true;
        private boolean requireLower = true;
        private boolean requireDigit = true;
        private boolean requireSpecial = true;
        private boolean rejectUsernameContained = true;
    }
}
