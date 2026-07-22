package com.cwgsyw.platform.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FunctionalPermissionAccessDeniedHandlerTest {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final FunctionalPermissionAccessDeniedHandler handler =
        new FunctionalPermissionAccessDeniedHandler(objectMapper);

    @Test
    void writesStableFunctionalPermissionDenialEnvelope() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        handler.handle(new MockHttpServletRequest(), response, new AccessDeniedException("denied"));

        JsonNode body = objectMapper.readTree(response.getContentAsString());
        assertEquals(403, response.getStatus());
        assertTrue(response.getContentType().startsWith("application/json"));
        assertEquals(403, body.get("code").asInt());
        assertEquals("FUNCTION_PERMISSION_DENIED", body.get("errorCode").asText());
        assertEquals("无权限", body.get("message").asText());
        assertTrue(body.get("data").isNull());
    }
}
