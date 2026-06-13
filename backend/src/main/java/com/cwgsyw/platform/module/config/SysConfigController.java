package com.cwgsyw.platform.module.config;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.config.dto.NotificationConfigRequest;
import com.cwgsyw.platform.module.config.dto.SmtpConfigRequest;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/config")
@RequiredArgsConstructor
public class SysConfigController {
    private final SysConfigService configService;

    @GetMapping
    @PreAuthorize("hasAuthority('notification:manage')")
    public R<Map<String, String>> getAll(@AuthenticationPrincipal SecurityUser user) {
        Map<String, String> all = configService.getAll(user.getTenantId());
        // mask SMTP password in response
        if (all.containsKey("smtp.password") && !all.get("smtp.password").isBlank()) {
            all.put("smtp.password", "••••••••");
        }
        return R.ok(all);
    }

    @PutMapping("/smtp")
    @PreAuthorize("hasAuthority('notification:manage')")
    public R<Void> updateSmtp(@AuthenticationPrincipal SecurityUser user,
                               @RequestBody SmtpConfigRequest req) {
        String tid = user.getTenantId();
        if (req.getEnabled() != null)  configService.set(tid, "smtp.enabled",   String.valueOf(req.getEnabled()));
        if (req.getHost() != null)     configService.set(tid, "smtp.host",      req.getHost());
        if (req.getPort() != null)     configService.set(tid, "smtp.port",      String.valueOf(req.getPort()));
        if (req.getUsername() != null) configService.set(tid, "smtp.username",  req.getUsername());
        if (req.getPassword() != null && !req.getPassword().startsWith("••")) {
            configService.set(tid, "smtp.password", req.getPassword());
        }
        if (req.getFrom() != null)     configService.set(tid, "smtp.from",      req.getFrom());
        if (req.getFromName() != null) configService.set(tid, "smtp.from_name", req.getFromName());
        if (req.getSsl() != null)      configService.set(tid, "smtp.ssl",       String.valueOf(req.getSsl()));
        return R.ok(null);
    }

    @PutMapping("/notification")
    @PreAuthorize("hasAuthority('notification:manage')")
    public R<Void> updateNotification(@AuthenticationPrincipal SecurityUser user,
                                       @RequestBody NotificationConfigRequest req) {
        String tid = user.getTenantId();
        if (req.getReminderEnabled() != null)
            configService.set(tid, "notify.reminder.enabled",  String.valueOf(req.getReminderEnabled()));
        if (req.getReminderCron() != null)
            configService.set(tid, "notify.reminder.cron",     req.getReminderCron());
        if (req.getReminderTemplate() != null)
            configService.set(tid, "notify.reminder.template", req.getReminderTemplate());
        return R.ok(null);
    }

    @PutMapping("/watermark")
    @PreAuthorize("hasAuthority('notification:manage')")
    public R<Void> updateWatermark(@AuthenticationPrincipal SecurityUser user,
                                    @RequestBody Map<String, Object> req) {
        String tid = user.getTenantId();
        if (req.containsKey("text"))     configService.set(tid, "watermark.text",      String.valueOf(req.get("text")));
        if (req.containsKey("opacity"))  configService.set(tid, "watermark.opacity",   String.valueOf(req.get("opacity")));
        if (req.containsKey("position")) configService.set(tid, "watermark.position",  String.valueOf(req.get("position")));
        if (req.containsKey("enabled"))  configService.set(tid, "watermark.enabled",   String.valueOf(req.get("enabled")));
        return R.ok(null);
    }
}
