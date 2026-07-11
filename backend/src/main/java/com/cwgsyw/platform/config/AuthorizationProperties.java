package com.cwgsyw.platform.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "authorization")
public class AuthorizationProperties {
    private DecisionMode decisionMode = DecisionMode.LEGACY;
    private boolean tenantAdminImplicitDataAccess = true;
    private boolean invalidateSessionsOnStartup = true;
    private long breakGlassTtlMinutes = 15;

    public enum DecisionMode {
        LEGACY,
        SHADOW,
        ENFORCED
    }
}
