package com.cwgsyw.platform.module.sharedfile.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName(value = "shared_folder_acl", autoResultMap = true)
public class SharedFolderAcl {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long folderId;
    /** 'role' | 'group' | 'user' */
    private String subjectType;
    private Long subjectId;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> permissions; // ["read","write","update","delete"]
    private Long createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime deletedAt;
    private Long deletedBy;
}
