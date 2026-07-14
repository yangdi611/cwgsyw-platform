package com.cwgsyw.platform.module.auth;

import com.cwgsyw.platform.module.auth.dto.LoginRequest;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.validation.BeanPropertyBindingResult;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class AuthControllerTest {
    @Test
    void invalidLoginRequestWritesFailedAuditAndKeepsBadRequestContract() {
        AuthService authService = mock(AuthService.class);
        AuthController controller = new AuthController(authService);
        LoginRequest request = new LoginRequest();
        BeanPropertyBindingResult bindingResult = new BeanPropertyBindingResult(request, "request");
        bindingResult.rejectValue("username", "NotBlank", "must not be blank");
        MockHttpServletRequest servletRequest = new MockHttpServletRequest();
        servletRequest.setRemoteAddr("127.0.0.1");

        var response = controller.login(request, bindingResult, servletRequest);

        assertEquals(400, response.getCode());
        ArgumentCaptor<String> ipCaptor = ArgumentCaptor.forClass(String.class);
        verify(authService).recordFailedLoginValidation(ipCaptor.capture());
        assertEquals("127.0.0.1", ipCaptor.getValue());
    }
}
