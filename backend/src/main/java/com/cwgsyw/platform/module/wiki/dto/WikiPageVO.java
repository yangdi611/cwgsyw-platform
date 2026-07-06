package com.cwgsyw.platform.module.wiki.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class WikiPageVO {
    private Long id;
    private Long spaceId;
    private Long parentId;
    private String title;
    private String slug;
    private String content;
    private String status;
    private Integer currentVersion;
    private boolean aclCustom;
    private LocalDateTime updatedAt;
    private String updatedByName;
    private int backlinkCount;
    /** 由 WikiPageService.toVO 计算，前端按钮显隐直接读取，不再依赖前端本地 hasPermission() */
    private boolean canWrite;
    private boolean canDelete;
    private boolean canPublish;
}
