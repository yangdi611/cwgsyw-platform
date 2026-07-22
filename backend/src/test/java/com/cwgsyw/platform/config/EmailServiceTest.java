package com.cwgsyw.platform.config;

import com.cwgsyw.platform.module.config.SysConfigService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EmailServiceTest {
    @Mock private SysConfigService configService;
    @InjectMocks private EmailService emailService;

    @Test
    void buildSender_disablesAuthenticationWhenUsernameIsBlank() throws Exception {
        when(configService.get("default", "smtp.host")).thenReturn("mailpit");
        when(configService.get("default", "smtp.port")).thenReturn("1025");
        when(configService.get("default", "smtp.username")).thenReturn("");
        when(configService.get("default", "smtp.password")).thenReturn("");
        when(configService.getBoolean("default", "smtp.ssl")).thenReturn(false);

        assertEquals("false", buildSender().getJavaMailProperties().get("mail.smtp.auth"));
    }

    @Test
    void buildSender_enablesAuthenticationWhenUsernameIsConfigured() throws Exception {
        when(configService.get("default", "smtp.host")).thenReturn("smtp.example.test");
        when(configService.get("default", "smtp.port")).thenReturn("587");
        when(configService.get("default", "smtp.username")).thenReturn("mailer");
        when(configService.get("default", "smtp.password")).thenReturn("secret");
        when(configService.getBoolean("default", "smtp.ssl")).thenReturn(false);

        assertEquals("true", buildSender().getJavaMailProperties().get("mail.smtp.auth"));
    }

    private JavaMailSenderImpl buildSender() throws Exception {
        Method method = EmailService.class.getDeclaredMethod("buildSender", String.class);
        method.setAccessible(true);
        return (JavaMailSenderImpl) method.invoke(emailService, "default");
    }
}
