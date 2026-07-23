package com.cwgsyw.platform.module.notification;

import com.cwgsyw.platform.module.changedoc.ChangeDocController;
import com.cwgsyw.platform.module.cmdb.controller.CiInstanceController;
import com.cwgsyw.platform.module.notification.dto.NotificationTargetVO;
import com.cwgsyw.platform.module.notification.entity.NotificationMessage;
import com.cwgsyw.platform.module.task.runtime.service.TaskRuntimeService;
import com.cwgsyw.platform.module.wiki.WikiController;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class NotificationTargetResolverService {
    private final NotificationMapper notificationMapper;
    private final ChangeDocController changeDocController;
    private final CiInstanceController ciInstanceController;
    private final WikiController wikiController;
    private final TaskRuntimeService taskRuntimeService;

    public NotificationTargetVO resolve(Long notificationId, SecurityUser user) {
        NotificationMessage notification = notificationMapper.selectById(notificationId);
        if (notification == null || !user.getUserId().equals(notification.getUserId())
                || notification.getRefType() == null || notification.getRefId() == null) {
            return NotificationTargetVO.unavailable();
        }
        try {
            return switch (notification.getRefType()) {
                case "change_doc" -> {
                    changeDocController.get(notification.getRefId(), user);
                    yield NotificationTargetVO.available("/change-docs/" + notification.getRefId());
                }
                case "task" -> {
                    taskRuntimeService.get(user, notification.getRefId());
                    yield NotificationTargetVO.available("/tasks/" + notification.getRefId());
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
                default -> NotificationTargetVO.unavailable();
            };
        } catch (RuntimeException exception) {
            return NotificationTargetVO.unavailable();
        }
    }
}
