package com.cwgsyw.platform.module.wiki.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class WikiVersionVO {
    private Integer version;
    private String title;
    private String comment;
    private String createdByName;
    private LocalDateTime createdAt;
}
