package com.cwgsyw.platform.module.wiki.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class WikiSearchResultVO {
    private Long pageId;
    private Long spaceId;
    private String title;
    private String highlight;
    private LocalDateTime updatedAt;
}
