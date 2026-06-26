package com.cwgsyw.platform.module.wiki.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class WikiSpaceVO {
    private Long id;
    private String name;
    private String description;
    private long pageCount;
    private LocalDateTime updatedAt;
    private String createdByName;
}
