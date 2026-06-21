package com.cwgsyw.platform.module.sharedfile.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName(value = "shared_file", autoResultMap = true)
public class SharedFile {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long folderId;
    private String name;
    private String originalName;
    private String fileType;
    private Long sizeBytes;
    private String minioKey;
    private String mdKey;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<Long> visibleGroups;
    private String sourceType;
    private Long sourceId;
    private Long createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime deletedAt;
    private Long deletedBy;
}
