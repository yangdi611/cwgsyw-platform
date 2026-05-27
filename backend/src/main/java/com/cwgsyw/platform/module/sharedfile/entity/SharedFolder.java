package com.cwgsyw.platform.module.sharedfile.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("shared_folder")
public class SharedFolder {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String name;
    private Long parentId;
    private Long createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime deletedAt;
    private Long deletedBy;
}
