package com.cwgsyw.platform.module.notification;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.notification.entity.NotificationMessage;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface NotificationMapper extends BaseMapper<NotificationMessage> {
    @Select("SELECT COUNT(*) FROM notification_message WHERE user_id = #{userId} AND is_read = false AND is_deleted = false")
    int countUnread(@Param("userId") Long userId);
}
