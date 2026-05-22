package com.cwgsyw.platform.config;

import com.cwgsyw.platform.module.config.SysConfigService;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import java.util.Properties;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {
    private final SysConfigService configService;

    public void send(String tenantId, String toEmail, String subject, String body) {
        if (!configService.getBoolean(tenantId, "smtp.enabled")) {
            log.debug("SMTP disabled for tenant {}, skip sending to {}", tenantId, toEmail);
            return;
        }
        if (toEmail == null || toEmail.isBlank()) {
            log.debug("No email address for recipient, skip");
            return;
        }
        try {
            JavaMailSenderImpl sender = buildSender(tenantId);
            MimeMessage msg = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(msg, false, "UTF-8");
            String fromName = configService.get(tenantId, "smtp.from_name");
            String fromAddr = configService.get(tenantId, "smtp.from");
            helper.setFrom(fromAddr, fromName);
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(body, false);
            sender.send(msg);
            log.info("Email sent to {} subject={}", toEmail, subject);
        } catch (Exception e) {
            log.error("Failed to send email to {}: {}", toEmail, e.getMessage());
        }
    }

    private JavaMailSenderImpl buildSender(String tenantId) {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(configService.get(tenantId, "smtp.host"));
        sender.setPort(Integer.parseInt(configService.get(tenantId, "smtp.port")));
        sender.setUsername(configService.get(tenantId, "smtp.username"));
        sender.setPassword(configService.get(tenantId, "smtp.password"));
        sender.setDefaultEncoding("UTF-8");
        Properties props = sender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth", "true");
        boolean ssl = configService.getBoolean(tenantId, "smtp.ssl");
        props.put("mail.smtp.ssl.enable", String.valueOf(ssl));
        props.put("mail.smtp.starttls.enable", String.valueOf(!ssl));
        return sender;
    }
}
