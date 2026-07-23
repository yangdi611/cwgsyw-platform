package com.cwgsyw.platform.module.notification;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.notification.entity.NotificationMessage;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface NotificationMapper extends BaseMapper<NotificationMessage> {
    @Insert("""
        INSERT INTO notification_message
          (tenant_id, user_id, title, content, type, ref_type, ref_id, dedupe_key,
           is_read, created_at)
        VALUES
          (#{tenantId}, #{userId}, #{title}, #{content}, #{type}, #{refType}, #{refId}, #{dedupeKey},
           FALSE, NOW())
        ON CONFLICT (tenant_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
        """)
    int insertIdempotent(@Param("tenantId") String tenantId, @Param("userId") Long userId,
                         @Param("title") String title, @Param("content") String content,
                         @Param("type") String type, @Param("refType") String refType,
                         @Param("refId") Long refId, @Param("dedupeKey") String dedupeKey);

    @Select("SELECT COUNT(*) FROM notification_message WHERE user_id = #{userId} AND is_read = false AND is_deleted = false")
    int countUnread(@Param("userId") Long userId);
}
