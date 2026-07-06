package com.cwgsyw.platform.module.wiki.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName(value = "wiki_space_acl", autoResultMap = true)
public class WikiSpaceAcl {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long spaceId;
    private String subjectType;
    private Long subjectId;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> permissions;
    private Long createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime deletedAt;
    private Long deletedBy;
}
