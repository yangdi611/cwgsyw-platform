package com.cwgsyw.platform.module.auth.session;

import com.cwgsyw.platform.config.AuthorizationProperties;
import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.*;

class SessionInvalidateOnStartupTest {

    @Test
    void startupDoesNotInvalidateSessionsUnlessExplicitlyEnabled() {
        AuthSessionService sessionService = mock(AuthSessionService.class);
        AuthorizationProperties properties = new AuthorizationProperties();
        properties.setInvalidateSessionsOnStartup(false);

        new SessionInvalidateOnStartup(sessionService, properties).onStartup();

        verifyNoInteractions(sessionService);
    }

    @Test
    void startupAdvancesEpochWhenExplicitlyEnabled() {
        AuthSessionService sessionService = mock(AuthSessionService.class);
        AuthorizationProperties properties = new AuthorizationProperties();
        properties.setInvalidateSessionsOnStartup(true);
        when(sessionService.advanceGlobalSessionEpoch()).thenReturn(2L);

        new SessionInvalidateOnStartup(sessionService, properties).onStartup();

        verify(sessionService).advanceGlobalSessionEpoch();
    }
}
