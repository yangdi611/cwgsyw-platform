package com.cwgsyw.platform.module.wiki.dto;

import lombok.Data;

@Data
public class CreatePageRequest {
    private Long spaceId;
    private Long parentId;
    private String title;
}
