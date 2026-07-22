package com.cwgsyw.platform.module.notification;

import com.cwgsyw.platform.module.changedoc.ChangeDocController;
import com.cwgsyw.platform.module.cmdb.controller.CiInstanceController;
import com.cwgsyw.platform.module.daily.DailyReportController;
import com.cwgsyw.platform.module.notification.dto.NotificationTargetVO;
import com.cwgsyw.platform.module.notification.entity.NotificationMessage;
import com.cwgsyw.platform.module.opscalendar.OpsCalendarTaskController;
import com.cwgsyw.platform.module.wiki.WikiController;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class NotificationTargetResolverService {
    private final NotificationMapper notificationMapper;
    private final ChangeDocController changeDocController;
    private final DailyReportController dailyReportController;
    private final CiInstanceController ciInstanceController;
    private final WikiController wikiController;
    private final OpsCalendarTaskController opsCalendarTaskController;

    public NotificationTargetVO resolve(Long notificationId, SecurityUser user) {
        NotificationMessage notification = notificationMapper.selectById(notificationId);
        if (notification == null || Boolean.TRUE.equals(notification.getIsDeleted())
                || !user.getUserId().equals(notification.getUserId())
                || notification.getRefType() == null || notification.getRefId() == null) {
            return NotificationTargetVO.unavailable();
        }
        try {
            return switch (notification.getRefType()) {
                case "change_doc" -> {
                    changeDocController.get(notification.getRefId(), user);
                    yield NotificationTargetVO.available("/change-docs/" + notification.getRefId());
                }
                case "daily_report" -> {
                    dailyReportController.getById(notification.getRefId(), user);
                    yield NotificationTargetVO.available("/daily/" + notification.getRefId());
                }
                case "ci_instance" -> {
                    var instance = ciInstanceController.getById(notification.getRefId(), user).getData();
                    String modelCode = instance.getModelCode();
                    if (modelCode == null || modelCode.isBlank()) yield NotificationTargetVO.unavailable();
                    yield NotificationTargetVO.available("/cmdb/instances/by-model/" + modelCode + "/" + notification.getRefId());
                }
                case "wiki_page" -> {
                    var page = wikiController.getPage(notification.getRefId(), user).getData();
                    yield NotificationTargetVO.available("/wiki/" + page.getSpaceId() + "/" + notification.getRefId());
                }
                case "ops_task" -> {
                    opsCalendarTaskController.detail(notification.getRefId(), user);
                    yield NotificationTargetVO.available("/ops-calendar?taskId=" + notification.getRefId());
                }
                default -> NotificationTargetVO.unavailable();
            };
        } catch (RuntimeException exception) {
            return NotificationTargetVO.unavailable();
        }
    }
}
