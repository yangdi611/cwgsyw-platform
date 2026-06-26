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
    /** Seeder 标识（同 space 内唯一），用于幂等查找；用户手建页面为 null */
    private String seedKey;
    /** md 内容 SHA-256 hex，seeder 据此判断是否需要更新 */
    private String seedHash;
}
