package com.cwgsyw.platform.module.authorization;

import com.cwgsyw.platform.config.AuthorizationProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthorizationModeService {
    private final AuthorizationProperties properties;
    private final JdbcTemplate jdbcTemplate;

    public EffectiveMode effectiveMode(String tenantId) {
        return switch (properties.getDecisionMode()) {
            case LEGACY -> EffectiveMode.LEGACY;
            case SHADOW -> EffectiveMode.SHADOW;
            case ENFORCED -> modeFromCutover(tenantId);
        };
    }

    public boolean isEnforced(String tenantId) {
        return effectiveMode(tenantId) == EffectiveMode.ENFORCED;
    }

    public String cutoverStatus(String tenantId) {
        String status = jdbcTemplate.query("""
            SELECT status FROM authorization_tenant_cutover WHERE tenant_id = ?
            """, rs -> rs.next() ? rs.getString(1) : null, tenantId);
        return status == null ? "preparing" : status;
    }

    private EffectiveMode modeFromCutover(String tenantId) {
        return switch (cutoverStatus(tenantId)) {
            case "enforced" -> EffectiveMode.ENFORCED;
            case "rollback" -> EffectiveMode.LEGACY;
            default -> EffectiveMode.SHADOW;
        };
    }

    public enum EffectiveMode {
        LEGACY,
        SHADOW,
        ENFORCED
    }
}
