package com.cwgsyw.platform.module.config;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.config.dto.NotificationConfigRequest;
import com.cwgsyw.platform.module.config.dto.PrometheusConfigRequest;
import com.cwgsyw.platform.module.config.dto.SmtpConfigRequest;
import com.cwgsyw.platform.module.config.dto.WatermarkConfigRequest;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/config")
@RequiredArgsConstructor
public class SysConfigController {
    private final SysConfigService configService;

    /**
     * 流程绑定类配置项白名单 —— 通过通用根 PUT 写入。
     * 前端流程配置面板（ProcessVersionSelector）通过 PUT /admin/config 写入这些 key，
     * 不能放开成任意 key，避免越权写入 smtp.password 等敏感配置。
     */
    private static final List<String> PROCESS_BINDING_CONFIG_KEYS = List.of(
        "daily_report_process_definition_id",
        "change_doc_process_definition_id",
        "device_access_process_definition_id"
    );

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

    /**
     * 通用配置写入 —— 目前仅用于流程绑定（日报/变更文档/设备权限的审批流程定义版本）。
     * 白名单校验：仅接受 PROCESS_BINDING_CONFIG_KEYS 中的 key，其余一律拒绝。
     */
    @PutMapping
    @PreAuthorize("hasPermission('workflow', 'configure')")
    public R<Void> updateGeneric(@AuthenticationPrincipal SecurityUser user,
                                  @RequestBody Map<String, Object> req) {
        if (req == null || req.isEmpty()) {
            throw new IllegalArgumentException("配置项不能为空");
        }
        String tid = user.getTenantId();
        for (Map.Entry<String, Object> entry : req.entrySet()) {
            if (!PROCESS_BINDING_CONFIG_KEYS.contains(entry.getKey())) {
                throw new IllegalArgumentException("不支持的配置项: " + entry.getKey());
            }
            if (entry.getValue() != null && !(entry.getValue() instanceof String)) {
                throw new IllegalArgumentException("配置项值必须为字符串: " + entry.getKey());
            }
        }
        for (String key : PROCESS_BINDING_CONFIG_KEYS) {
            if (req.containsKey(key)) {
                Object v = req.get(key);
                configService.set(tid, key, v != null ? String.valueOf(v) : null);
            }
        }
        return R.ok(null);
    }

    @PutMapping("/smtp")
    @PreAuthorize("hasAuthority('notification:manage')")
    public R<Void> updateSmtp(@AuthenticationPrincipal SecurityUser user,
                               @jakarta.validation.Valid @RequestBody SmtpConfigRequest req) {
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

    @PutMapping("/prometheus")
    @PreAuthorize("hasAuthority('notification:manage')")
    public R<Void> updatePrometheus(@AuthenticationPrincipal SecurityUser user,
                                     @jakarta.validation.Valid @RequestBody PrometheusConfigRequest req) {
        String tid = user.getTenantId();
        if (req.getEnabled() != null) {
            configService.set(tid, "prometheus.enabled", String.valueOf(req.getEnabled()));
        }
        if (req.getUrl() != null) {
            validatePrometheusUrl(req.getUrl());
            configService.set(tid, "prometheus.url", req.getUrl().trim().replaceAll("/+$", ""));
        }
        if (req.getScrapeInterval() != null) {
            configService.set(tid, "prometheus.scrape_interval", String.valueOf(req.getScrapeInterval()));
        }
        return R.ok(null);
    }

    @PutMapping("/watermark")
    @PreAuthorize("hasAuthority('notification:manage')")
    public R<Void> updateWatermark(@AuthenticationPrincipal SecurityUser user,
                                    @RequestBody WatermarkConfigRequest req) {
        String tid = user.getTenantId();
        if (req.getText() != null)     configService.set(tid, "watermark.text",     req.getText());
        if (req.getOpacity() != null)  configService.set(tid, "watermark.opacity",  String.valueOf(req.getOpacity()));
        if (req.getPosition() != null) configService.set(tid, "watermark.position", req.getPosition());
        if (req.getEnabled() != null)  configService.set(tid, "watermark.enabled",  String.valueOf(req.getEnabled()));
        return R.ok(null);
    }

    private void validatePrometheusUrl(String url) {
        String normalized = url.trim();
        if (normalized.isEmpty()) return;
        try {
            java.net.URI uri = java.net.URI.create(normalized);
            if (!"http".equalsIgnoreCase(uri.getScheme()) && !"https".equalsIgnoreCase(uri.getScheme())) {
                throw new IllegalArgumentException("Prometheus 地址必须使用 HTTP 或 HTTPS");
            }
            if (uri.getHost() == null || uri.getHost().isBlank()) {
                throw new IllegalArgumentException("Prometheus 地址必须包含主机名");
            }
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Prometheus 地址格式不正确", exception);
        }
    }
}
