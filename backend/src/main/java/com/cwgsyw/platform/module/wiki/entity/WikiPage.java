package com.cwgsyw.platform.module.wiki.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("wiki_page")
public class WikiPage {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long spaceId;
    private Long parentId;
    private String slug;
    private String title;
    private String content;
    /** draft / review / published / archived */
    private String status;
    private Integer currentVersion;
    private String processInstanceId;
    private Integer sortOrder;
    private Boolean aclInherited;
    private Long createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long updatedBy;
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime deletedAt;
    private Long deletedBy;
}
