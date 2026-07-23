package com.cwgsyw.platform.module.task.notification;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TaskNotificationOutbox {
    private final TaskNotificationDeliveryMapper mapper;
    private final ObjectMapper objectMapper;

    public boolean enqueue(String tenantId, Long taskId, Long submissionId, Long approvalRoundId,
                           String eventType, Long recipientId, String channel, String dedupeKey,
                           Map<String, Object> payload, LocalDateTime nextAttemptAt) {
        return enqueue(tenantId, taskId, submissionId, approvalRoundId, eventType, recipientId,
            channel, dedupeKey, null, null, payload, nextAttemptAt);
    }

    public boolean enqueueSubscription(String tenantId, Long subscriptionId, String batchKey,
                                       Long recipientId, String channel, String dedupeKey,
                                       Map<String, Object> payload, LocalDateTime nextAttemptAt) {
        return enqueue(tenantId, null, null, null, "analytics_subscription", recipientId,
            channel, dedupeKey, subscriptionId, batchKey, payload, nextAttemptAt);
    }

    private boolean enqueue(String tenantId, Long taskId, Long submissionId, Long approvalRoundId,
                            String eventType, Long recipientId, String channel, String dedupeKey,
                            Long subscriptionId, String batchKey, Map<String, Object> payload,
                            LocalDateTime nextAttemptAt) {
        try {
            return mapper.enqueue(tenantId, taskId, submissionId, approvalRoundId, eventType, recipientId,
                channel, dedupeKey, subscriptionId, batchKey, objectMapper.writeValueAsString(payload),
                nextAttemptAt) == 1;
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("任务通知 payload 无法序列化", exception);
        }
    }
}
