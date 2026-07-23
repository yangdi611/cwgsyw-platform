package com.cwgsyw.platform.module.task.runtime.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@TableName(value = "task_event", autoResultMap = true)
public class TaskEvent {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long taskId;
    private String eventType;
    private Long operatorId;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> eventData;
    private LocalDateTime createdAt;
}
