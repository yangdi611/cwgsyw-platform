package com.cwgsyw.platform.module.notification;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.config.EmailService;
import com.cwgsyw.platform.module.notification.dto.NotificationVO;
import com.cwgsyw.platform.module.notification.entity.NotificationMessage;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {
    private final NotificationMapper notificationMapper;
    private final EmailService emailService;
    private final UserMapper userMapper;

    public void notify(String tenantId, Long userId, String title, String content,
                       String type, String refType, Long refId) {
        NotificationMessage msg = NotificationMessage.builder()
            .tenantId(tenantId)
            .userId(userId)
            .title(title)
            .content(content)
            .type(type)
            .refType(refType)
            .refId(refId)
            .isRead(false)
            .isDeleted(false)
            .createdAt(LocalDateTime.now())
            .updatedAt(LocalDateTime.now())
            .build();
        notificationMapper.insert(msg);

        User user = userMapper.selectById(userId);
        if (user != null && user.getEmail() != null && !user.getEmail().isBlank()) {
            emailService.send(tenantId, user.getEmail(), title, content);
        }
    }

    public int countUnread(Long userId) {
        return notificationMapper.countUnread(userId);
    }

    public PageResult<NotificationVO> listByUser(Long userId, int page, int size) {
        Page<NotificationMessage> p = notificationMapper.selectPage(
            new Page<>(page, size),
            new LambdaQueryWrapper<NotificationMessage>()
                .eq(NotificationMessage::getUserId, userId)
                .eq(NotificationMessage::getIsDeleted, false)
                .orderByDesc(NotificationMessage::getCreatedAt));
        return PageResult.of(p.convert(this::toVO));
    }

    public void markRead(Long id, Long userId) {
        notificationMapper.update(null, new LambdaUpdateWrapper<NotificationMessage>()
            .eq(NotificationMessage::getId, id)
            .eq(NotificationMessage::getUserId, userId)
            .set(NotificationMessage::getIsRead, true)
            .set(NotificationMessage::getReadAt, LocalDateTime.now()));
    }

    public void markAllRead(Long userId) {
        notificationMapper.update(null, new LambdaUpdateWrapper<NotificationMessage>()
            .eq(NotificationMessage::getUserId, userId)
            .eq(NotificationMessage::getIsRead, false)
            .set(NotificationMessage::getIsRead, true)
            .set(NotificationMessage::getReadAt, LocalDateTime.now()));
    }

    private NotificationVO toVO(NotificationMessage m) {
        NotificationVO vo = new NotificationVO();
        vo.setId(m.getId());
        vo.setTitle(m.getTitle());
        vo.setContent(m.getContent());
        vo.setType(m.getType());
        vo.setRefType(m.getRefType());
        vo.setRefId(m.getRefId());
        vo.setIsRead(m.getIsRead());
        vo.setCreatedAt(m.getCreatedAt());
        return vo;
    }
}
