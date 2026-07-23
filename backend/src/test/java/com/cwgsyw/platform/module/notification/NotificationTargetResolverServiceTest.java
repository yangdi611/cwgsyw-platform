package com.cwgsyw.platform.module.notification;

import com.cwgsyw.platform.module.notification.dto.NotificationTargetVO;
import com.cwgsyw.platform.module.notification.entity.NotificationMessage;
import com.cwgsyw.platform.module.task.runtime.service.TaskRuntimeService;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationTargetResolverServiceTest {
    private final NotificationMapper notificationMapper = mock(NotificationMapper.class);
    private final TaskRuntimeService taskRuntimeService = mock(TaskRuntimeService.class);
    private final NotificationTargetResolverService service = new NotificationTargetResolverService(
        notificationMapper,
        mock(com.cwgsyw.platform.module.changedoc.ChangeDocController.class),
        mock(com.cwgsyw.platform.module.cmdb.controller.CiInstanceController.class),
        mock(com.cwgsyw.platform.module.wiki.WikiController.class),
        taskRuntimeService);

    @Test
    void resolveTask_returnsUnifiedTaskRouteWhenTaskIsAccessible() {
        SecurityUser user = user();
        when(notificationMapper.selectById(901L)).thenReturn(notification(901L, user.getUserId(), 108L));

        NotificationTargetVO target = service.resolve(901L, user);

        assertThat(target.isAvailable()).isTrue();
        assertThat(target.getHref()).isEqualTo("/tasks/108");
        verify(taskRuntimeService).get(user, 108L);
    }

    @Test
    void resolveTask_returnsUnavailableWhenTaskIsOutsideScope() {
        SecurityUser user = user();
        when(notificationMapper.selectById(902L)).thenReturn(notification(902L, user.getUserId(), 109L));
        when(taskRuntimeService.get(user, 109L)).thenThrow(new IllegalArgumentException("任务不存在"));

        NotificationTargetVO target = service.resolve(902L, user);

        assertThat(target.isAvailable()).isFalse();
        assertThat(target.getHref()).isNull();
    }

    private NotificationMessage notification(Long id, Long userId, Long refId) {
        return NotificationMessage.builder()
            .id(id).tenantId("default").userId(userId).title("统一任务").content("任务通知")
            .type("task").refType("task").refId(refId).build();
    }

    private SecurityUser user() {
        return new SecurityUser(30L, "reader", "", "default", 3L, "group",
            Set.of("notification:read", "task:read"));
    }
}
