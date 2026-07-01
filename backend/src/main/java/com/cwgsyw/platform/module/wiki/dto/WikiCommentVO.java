package com.cwgsyw.platform.module.wiki.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class WikiCommentVO {
    private Long id;
    private Long pageId;
    private String content;
    private Long createdBy;
    private String createdByName;
    private LocalDateTime createdAt;
    private Boolean canDelete;
}
