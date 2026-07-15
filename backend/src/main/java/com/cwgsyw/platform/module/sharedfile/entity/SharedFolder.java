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
    private String normalizedName;
    private Long parentId;
    private Long ownerGroupId;
    private Long createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    /** TRUE = 继承父文件夹 ACL（默认）；FALSE = 使用自定义 ACL */
    private Boolean aclInherited;
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime deletedAt;
    private Long deletedBy;
}
