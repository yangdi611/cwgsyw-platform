package com.cwgsyw.platform.module.authorization;

import com.cwgsyw.platform.config.AuthorizationProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;

import java.sql.ResultSet;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthorizationModeServiceTest {
    @Mock JdbcTemplate jdbcTemplate;
    @Mock ResultSet resultSet;

    private AuthorizationProperties properties;
    private AuthorizationModeService service;

    @BeforeEach
    void setUp() {
        properties = new AuthorizationProperties();
        service = new AuthorizationModeService(properties, jdbcTemplate);
    }

    @Test
    void legacyConfigurationDoesNotReadCutoverTable() {
        assertEquals(AuthorizationModeService.EffectiveMode.LEGACY, service.effectiveMode("default"));
        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    void enforcedConfigurationWithoutCutoverRemainsShadow() {
        properties.setDecisionMode(AuthorizationProperties.DecisionMode.ENFORCED);
        when(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class), eq("default")))
            .thenReturn(null);

        assertEquals(AuthorizationModeService.EffectiveMode.SHADOW, service.effectiveMode("default"));
    }

    @Test
    void tenantCutoverActivatesStrictEnforcement() throws Exception {
        properties.setDecisionMode(AuthorizationProperties.DecisionMode.ENFORCED);
        when(resultSet.next()).thenReturn(true);
        when(resultSet.getString(1)).thenReturn("enforced");
        when(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class), eq("default")))
            .thenAnswer(invocation -> ((ResultSetExtractor<?>) invocation.getArgument(1)).extractData(resultSet));

        assertEquals(AuthorizationModeService.EffectiveMode.ENFORCED, service.effectiveMode("default"));
    }
}
