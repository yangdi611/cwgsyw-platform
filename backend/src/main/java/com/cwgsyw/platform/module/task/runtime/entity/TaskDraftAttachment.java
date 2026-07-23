package com.cwgsyw.platform.module.task.runtime.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("task_draft_attachment")
public class TaskDraftAttachment {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long taskId;
    private Integer draftRevision;
    private String fieldKey;
    private String fileName;
    private String fileType;
    private Long sizeBytes;
    private String objectKey;
    private String checksum;
    private Long uploadedBy;
    private LocalDateTime uploadedAt;
}
