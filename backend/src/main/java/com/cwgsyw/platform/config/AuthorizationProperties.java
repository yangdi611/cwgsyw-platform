package com.cwgsyw.platform.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "authorization")
public class AuthorizationProperties {
    private boolean tenantAdminImplicitDataAccess = true;
    private boolean invalidateSessionsOnStartup = false;
    private long breakGlassTtlMinutes = 15;
}
