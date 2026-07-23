package com.cwgsyw.platform.module.task.notification;

import com.cwgsyw.platform.config.EmailService;
import com.cwgsyw.platform.module.notification.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskNotificationDispatcherTest {
    @Mock TaskNotificationDeliveryMapper mapper;
    @Mock NotificationService notificationService;
    @Mock EmailService emailService;
    @Mock TransactionTemplate transactionTemplate;

    private TaskNotificationDispatcher dispatcher;

    @BeforeEach
    void setUp() {
        dispatcher = new TaskNotificationDispatcher(mapper, notificationService, emailService, transactionTemplate);
        doAnswer(invocation -> {
            Consumer<TransactionStatus> callback = invocation.getArgument(0);
            callback.accept(mock(TransactionStatus.class));
            return null;
        }).when(transactionTemplate).executeWithoutResult(any());
    }

    @Test
    void notificationDeliveryIsIdempotentAndCompletesSubscriptionBatch() {
        LocalDateTime now = LocalDateTime.of(2026, 7, 23, 9, 0);
        TaskNotificationDelivery delivery = delivery("notification");
        when(mapper.claim("tenant-a", 9L, now, now.plusMinutes(5))).thenReturn(1);
        when(mapper.selectById(9L)).thenReturn(delivery);
        when(notificationService.notifyIdempotent(any(), any(), any(), any(), any(), any(), any(), any()))
            .thenReturn(true);

        dispatcher.dispatch(delivery, now);

        verify(notificationService).notifyIdempotent("tenant-a", 11L, "统计提醒", "内容",
            "analytics_subscription", "task_analytics_dashboard", 19L, "task-delivery:9");
        verify(mapper).markSubscriptionDeliveredIfComplete("tenant-a", 3L, "scheduled:2026-07-23T09:00", now);
        ArgumentCaptor<TaskNotificationDelivery> saved = ArgumentCaptor.forClass(TaskNotificationDelivery.class);
        verify(mapper).updateById(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo("sent");
        verify(emailService, never()).sendStrict(any(), any(), any(), any());
    }

    @Test
    void emailFailureRemainsRetryableAndDoesNotMarkSubscriptionSent() {
        LocalDateTime now = LocalDateTime.of(2026, 7, 23, 9, 0);
        TaskNotificationDelivery delivery = delivery("email");
        when(mapper.claim("tenant-a", 9L, now, now.plusMinutes(5))).thenReturn(1);
        when(mapper.selectById(9L)).thenReturn(delivery);
        doThrow(new IllegalStateException("smtp unavailable")).when(emailService)
            .sendStrict("tenant-a", "ops@example.test", "统计提醒", "内容");

        dispatcher.dispatch(delivery, now);

        ArgumentCaptor<TaskNotificationDelivery> saved = ArgumentCaptor.forClass(TaskNotificationDelivery.class);
        verify(mapper).updateById(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo("failed");
        assertThat(saved.getValue().getAttemptCount()).isEqualTo(1);
        assertThat(saved.getValue().getNextAttemptAt()).isEqualTo(now.plusMinutes(5));
        verify(mapper, never()).markSubscriptionDeliveredIfComplete(any(), any(), any(), any());
        verify(notificationService, never()).notifyIdempotent(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void fifthFailureMovesDeliveryToDeadLetter() {
        LocalDateTime now = LocalDateTime.of(2026, 7, 23, 9, 0);
        TaskNotificationDelivery delivery = delivery("email");
        delivery.setAttemptCount(4);
        when(mapper.claim("tenant-a", 9L, now, now.plusMinutes(5))).thenReturn(1);
        when(mapper.selectById(9L)).thenReturn(delivery);
        doThrow(new IllegalStateException("smtp unavailable")).when(emailService)
            .sendStrict("tenant-a", "ops@example.test", "统计提醒", "内容");

        dispatcher.dispatch(delivery, now);

        ArgumentCaptor<TaskNotificationDelivery> saved = ArgumentCaptor.forClass(TaskNotificationDelivery.class);
        verify(mapper).updateById(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo("dead");
        assertThat(saved.getValue().getAttemptCount()).isEqualTo(5);
        assertThat(saved.getValue().getNextAttemptAt()).isNull();
        verify(mapper, never()).markSubscriptionDeliveredIfComplete(any(), any(), any(), any());
    }

    private TaskNotificationDelivery delivery(String channel) {
        TaskNotificationDelivery value = new TaskNotificationDelivery();
        value.setId(9L); value.setTenantId("tenant-a"); value.setRecipientId(11L); value.setChannel(channel);
        value.setEventType("analytics_subscription"); value.setStatus("pending"); value.setAttemptCount(0);
        value.setSubscriptionId(3L); value.setBatchKey("scheduled:2026-07-23T09:00");
        value.setPayload(Map.of("title", "统计提醒", "content", "内容", "refType",
            "task_analytics_dashboard", "refId", 19L, "email", "ops@example.test"));
        return value;
    }
}
