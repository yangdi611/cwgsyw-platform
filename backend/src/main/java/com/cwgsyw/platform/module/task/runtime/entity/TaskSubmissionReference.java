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
@TableName(value = "task_submission_reference", autoResultMap = true)
public class TaskSubmissionReference {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long submissionId;
    private Long taskId;
    private String fieldKey;
    private String refType;
    private String refKey;
    private String sourceLevel;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> refSnapshot;
    private LocalDateTime createdAt;
}
