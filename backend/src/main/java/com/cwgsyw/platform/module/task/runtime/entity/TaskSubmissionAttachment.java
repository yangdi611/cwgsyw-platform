package com.cwgsyw.platform.module.task.runtime.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("task_submission_attachment")
public class TaskSubmissionAttachment {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long submissionId;
    private String fieldKey;
    private String fileName;
    private String fileType;
    private Long sizeBytes;
    private String objectKey;
    private String checksum;
    private Boolean sensitive;
    private Long uploadedBy;
    private LocalDateTime uploadedAt;
}
