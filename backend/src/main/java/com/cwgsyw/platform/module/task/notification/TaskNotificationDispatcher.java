package com.cwgsyw.platform.module.task.notification;

import com.cwgsyw.platform.config.EmailService;
import com.cwgsyw.platform.module.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class TaskNotificationDispatcher {
    private static final int MAX_ATTEMPTS = 5;

    private final TaskNotificationDeliveryMapper mapper;
    private final NotificationService notificationService;
    private final EmailService emailService;
    private final TransactionTemplate transactionTemplate;

    @Scheduled(cron = "10 * * * * *")
    public void dispatchDue() {
        LocalDateTime now = LocalDateTime.now();
        mapper.findDue(now, 100).forEach(delivery -> dispatch(delivery, now));
    }

    void dispatch(TaskNotificationDelivery delivery, LocalDateTime now) {
        if (mapper.claim(delivery.getTenantId(), delivery.getId(), now, now.plusMinutes(5)) != 1) return;
        try {
            Map<String, Object> payload = delivery.getPayload() == null ? Map.of() : delivery.getPayload();
            deliver(delivery, payload);
            transactionTemplate.executeWithoutResult(status -> markSent(delivery.getId(), now));
        } catch (RuntimeException exception) {
            transactionTemplate.executeWithoutResult(status -> markFailed(delivery.getId(), exception, now));
            log.warn("Task notification delivery {} failed: {}", delivery.getId(), exception.getMessage());
        }
    }

    private void markSent(Long id, LocalDateTime now) {
        TaskNotificationDelivery value = mapper.selectById(id);
        if (value == null) return;
        value.setStatus("sent");
        value.setAttemptCount((value.getAttemptCount() == null ? 0 : value.getAttemptCount()) + 1);
        value.setSentAt(now); value.setNextAttemptAt(null); value.setLastError(null); value.setUpdatedAt(now);
        mapper.updateById(value);
        if (value.getSubscriptionId() != null && value.getBatchKey() != null) {
            mapper.markSubscriptionDeliveredIfComplete(value.getTenantId(), value.getSubscriptionId(),
                value.getBatchKey(), now);
        }
    }

    private void markFailed(Long id, RuntimeException exception, LocalDateTime now) {
        TaskNotificationDelivery value = mapper.selectById(id);
        if (value == null) return;
        int attempts = (value.getAttemptCount() == null ? 0 : value.getAttemptCount()) + 1;
        value.setAttemptCount(attempts); value.setStatus(attempts >= MAX_ATTEMPTS ? "dead" : "failed");
        value.setNextAttemptAt(attempts >= MAX_ATTEMPTS ? null : now.plusMinutes(Math.min(30, attempts * 5L)));
        String message = exception.getMessage() == null ? exception.getClass().getSimpleName() : exception.getMessage();
        value.setLastError(message.substring(0, Math.min(1000, message.length()))); value.setUpdatedAt(now);
        mapper.updateById(value);
    }

    private String text(Map<String, Object> payload, String key, String defaultValue) {
        Object value = payload.get(key); return value == null ? defaultValue : String.valueOf(value);
    }

    private Long number(Object value, Long defaultValue) {
        if (value == null) return defaultValue;
        return value instanceof Number number ? number.longValue() : Long.valueOf(String.valueOf(value));
    }

    private void deliver(TaskNotificationDelivery delivery, Map<String, Object> payload) {
        String title = text(payload, "title", "任务通知");
        String content = text(payload, "content", "你有一条新的任务通知");
        if ("email".equals(delivery.getChannel())) {
            emailService.sendStrict(delivery.getTenantId(), text(payload, "email", null), title, content);
            return;
        }
        if (!"notification".equals(delivery.getChannel())) {
            throw new IllegalArgumentException("Unsupported task notification channel: " + delivery.getChannel());
        }
        notificationService.notifyIdempotent(delivery.getTenantId(), delivery.getRecipientId(), title, content,
            delivery.getEventType(), text(payload, "refType", "task"),
            number(payload.get("refId"), delivery.getTaskId()), "task-delivery:" + delivery.getId());
    }
}
