package com.cwgsyw.platform.module.notification;

import com.cwgsyw.platform.module.notification.dto.NotificationTargetVO;
import com.cwgsyw.platform.module.notification.entity.NotificationMessage;
import com.cwgsyw.platform.module.opscalendar.OpsCalendarTaskController;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationTargetResolverServiceTest {

    private final NotificationMapper notificationMapper = mock(NotificationMapper.class);
    private final OpsCalendarTaskController opsCalendarTaskController = mock(OpsCalendarTaskController.class);
    private final NotificationTargetResolverService service = new NotificationTargetResolverService(
            notificationMapper, mock(com.cwgsyw.platform.module.changedoc.ChangeDocController.class),
            mock(com.cwgsyw.platform.module.daily.DailyReportController.class),
            mock(com.cwgsyw.platform.module.cmdb.controller.CiInstanceController.class),
            mock(com.cwgsyw.platform.module.wiki.WikiController.class), opsCalendarTaskController);

    @Test
    void resolveOpsTask_returnsRouteWhenDetailIsAccessible() {
        SecurityUser user = user();
        when(notificationMapper.selectById(901L)).thenReturn(notification(901L, user.getUserId(), 108L));

        NotificationTargetVO target = service.resolve(901L, user);

        assertThat(target.isAvailable()).isTrue();
        assertThat(target.getHref()).isEqualTo("/ops-calendar?taskId=108");
        verify(opsCalendarTaskController).detail(108L, user);
    }

    @Test
    void resolveOpsTask_returnsUnavailableWhenDetailIsOutsideScope() {
        SecurityUser user = user();
        when(notificationMapper.selectById(902L)).thenReturn(notification(902L, user.getUserId(), 109L));
        when(opsCalendarTaskController.detail(109L, user))
                .thenThrow(new IllegalArgumentException("任务不存在"));

        NotificationTargetVO target = service.resolve(902L, user);

        assertThat(target.isAvailable()).isFalse();
        assertThat(target.getHref()).isNull();
    }

    private NotificationMessage notification(Long id, Long userId, Long refId) {
        return NotificationMessage.builder()
                .id(id)
                .tenantId("default")
                .userId(userId)
                .title("运维任务")
                .content("任务通知")
                .type("ops_calendar")
                .refType("ops_task")
                .refId(refId)
                .isDeleted(false)
                .build();
    }

    private SecurityUser user() {
        return new SecurityUser(30L, "reader", "", "default", 3L, "group",
                Set.of("notification:read", "ops_calendar:read"));
    }
}
