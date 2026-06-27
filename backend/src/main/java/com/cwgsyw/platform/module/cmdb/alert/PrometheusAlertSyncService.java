package com.cwgsyw.platform.module.cmdb.alert;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.alert.entity.CmdbAlert;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.config.SysConfigService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.SchedulingConfigurer;
import org.springframework.scheduling.config.ScheduledTaskRegistrar;
import org.springframework.scheduling.support.PeriodicTrigger;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class PrometheusAlertSyncService implements SchedulingConfigurer {

    private final SysConfigService configService;
    private final CmdbAlertMapper alertMapper;
    private final AuditLogMapper auditLogMapper;
    private final CiInstanceMapper ciInstanceMapper;
    private final ObjectMapper objectMapper;

    private final RestClient restClient = RestClient.create();

    private static final Pattern IP_FROM_INSTANCE = Pattern.compile("^([\\d.]+)(?::\\d+)?$");
    private static final DateTimeFormatter PROM_TS_FMT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss[.SSSSSSXXX]");

    /** 抓取间隔下限/默认值（秒），防止配置过小压垮 Prometheus */
    private static final int MIN_INTERVAL_SEC = 10;
    private static final int DEFAULT_INTERVAL_SEC = 60;

    /**
     * 动态调度：每轮执行后用 PeriodicTrigger 重新读取 sys_config 中的
     * prometheus.scrape_interval，使前端 /admin/config 配置真正生效（取代旧的硬编码 30s）。
     */
    @Override
    public void configureTasks(ScheduledTaskRegistrar registrar) {
        registrar.addTriggerTask(this::syncAlerts, triggerContext -> {
            // 每次执行后重算下次间隔，配置改了无需重启
            PeriodicTrigger pt = new PeriodicTrigger(Duration.ofSeconds(resolveIntervalSeconds()));
            return pt.nextExecution(triggerContext);
        });
    }

    private int resolveIntervalSeconds() {
        try {
            String raw = configService.get("default", "prometheus.scrape_interval");
            if (raw == null || raw.isBlank()) return DEFAULT_INTERVAL_SEC;
            int sec = Integer.parseInt(raw.trim());
            return Math.max(sec, MIN_INTERVAL_SEC);
        } catch (Exception e) {
            return DEFAULT_INTERVAL_SEC;
        }
    }

    public void syncAlerts() {
        try {
            String tenantId = "default";
            if (!configService.getBoolean(tenantId, "prometheus.enabled")) {
                return;
            }

            String prometheusUrl = configService.get(tenantId, "prometheus.url");
            if (prometheusUrl == null || prometheusUrl.isBlank()) {
                return;
            }

            String url = prometheusUrl.replaceAll("/+$", "") + "/api/v1/alerts";
            String body = restClient.get()
                    .uri(url)
                    .retrieve()
                    .body(String.class);

            if (body == null) return;

            JsonNode root = objectMapper.readTree(body);
            JsonNode alerts = root.path("data").path("alerts");
            if (!alerts.isArray()) return;

            for (JsonNode alert : alerts) {
                try {
                    processAlert(alert, tenantId);
                } catch (Exception e) {
                    log.warn("Failed to process single alert: {}", e.getMessage());
                }
            }
        } catch (Exception e) {
            log.warn("Prometheus alert sync failed: {}", e.getMessage());
        }
    }

    private void processAlert(JsonNode alert, String tenantId) {
        String fingerprint = alert.path("fingerprint").asText("");
        if (fingerprint.isEmpty()) return;

        String status = alert.path("status").asText("firing");
        String alertName = alert.path("labels").path("alertname").asText("unknown");
        String severity = alert.path("labels").path("severity").asText("warning");
        String summary = alert.path("annotations").path("summary").asText(null);
        String description = alert.path("annotations").path("description").asText(null);

        String startsAtStr = alert.path("startsAt").asText("");
        String endsAtStr = alert.path("endsAt").asText("0001-01-01T00:00:00Z");

        LocalDateTime startsAt = parsePromTimestamp(startsAtStr);
        LocalDateTime endsAt = endsAtStr.startsWith("0001") ? null : parsePromTimestamp(endsAtStr);

        String rawLabels = alert.path("labels").toString();

        // Resolve CI instance from labels
        Long ciInstanceId = resolveCiInstance(alert.path("labels"), tenantId);

        CmdbAlert existing = alertMapper.findByFingerprint(fingerprint, tenantId).orElse(null);

        if (existing == null) {
            // New alert — insert
            CmdbAlert newAlert = new CmdbAlert();
            newAlert.setTenantId(tenantId);
            newAlert.setCiInstanceId(ciInstanceId);
            newAlert.setAlertName(alertName);
            newAlert.setSeverity(severity);
            newAlert.setStatus("firing");
            newAlert.setFingerprint(fingerprint);
            newAlert.setSummary(summary);
            newAlert.setDescription(description);
            newAlert.setStartsAt(startsAt);
            newAlert.setEndsAt(endsAt);
            newAlert.setRawLabels(rawLabels);
            newAlert.setAcknowledged(false);
            newAlert.setCreatedBy(0L);
            newAlert.setUpdatedBy(0L);
            alertMapper.insert(newAlert);

            auditLogMapper.insert(AuditLog.builder()
                    .tenantId(tenantId)
                    .module("cmdb")
                    .action("alert_fired")
                    .targetId(newAlert.getId())
                    .targetType("cmdb_alert")
                    .operatorId(0L)
                    .remark(alertName)
                    .createdAt(LocalDateTime.now())
                    .build());
        } else if (!existing.getStatus().equals(status)) {
            // Status changed (e.g. firing → resolved)
            existing.setStatus(status);
            existing.setEndsAt(endsAt != null ? endsAt : LocalDateTime.now());
            existing.setUpdatedBy(0L);
            alertMapper.updateById(existing);

            auditLogMapper.insert(AuditLog.builder()
                    .tenantId(tenantId)
                    .module("cmdb")
                    .action("alert_resolved")
                    .targetId(existing.getId())
                    .targetType("cmdb_alert")
                    .operatorId(0L)
                    .remark(alertName)
                    .createdAt(LocalDateTime.now())
                    .build());
        }
    }

    private Long resolveCiInstance(JsonNode labels, String tenantId) {
        // 1. Try "instance" label (format "192.168.1.1:9090" → extract IP)
        String instance = labels.path("instance").asText("");
        if (!instance.isEmpty()) {
            Matcher m = IP_FROM_INSTANCE.matcher(instance);
            if (m.matches()) {
                String ip = m.group(1);
                Long id = findInstanceByIp(ip, tenantId);
                if (id != null) return id;
                // Also try hostname part before the IP
                // instance label can also be hostname:port, skip if not IP
            }
        }

        // 2. Try "ip" label directly
        String ip = labels.path("ip").asText("");
        if (!ip.isEmpty()) {
            Long id = findInstanceByIp(ip, tenantId);
            if (id != null) return id;
        }

        return null;
    }

    private Long findInstanceByIp(String ip, String tenantId) {
        // 主机模型（V14）内置内网 IP 属性 key 为 inner_ip，不是 ip
        List<CiInstance> instances = ciInstanceMapper.selectList(
                new LambdaQueryWrapper<CiInstance>()
                        .eq(CiInstance::getTenantId, tenantId)
                        .apply("attrs->>'inner_ip' = {0}", ip));
        if (!instances.isEmpty()) return instances.get(0).getId();

        // Also try matching by name (hostname)
        instances = ciInstanceMapper.selectList(
                new LambdaQueryWrapper<CiInstance>()
                        .eq(CiInstance::getTenantId, tenantId)
                        .eq(CiInstance::getName, ip));
        if (!instances.isEmpty()) return instances.get(0).getId();

        return null;
    }

    private LocalDateTime parsePromTimestamp(String ts) {
        if (ts == null || ts.isEmpty()) return null;
        try {
            // Prometheus timestamps are RFC3339 / ISO8601
            return LocalDateTime.parse(ts, DateTimeFormatter.ISO_DATE_TIME);
        } catch (Exception e) {
            try {
                return LocalDateTime.parse(ts, PROM_TS_FMT);
            } catch (Exception ex) {
                return null;
            }
        }
    }
}
