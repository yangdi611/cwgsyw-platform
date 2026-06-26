package com.cwgsyw.platform.module.wiki.dto;

import lombok.Data;

@Data
public class SavePageRequest {
    private String title;
    private String content;
    private String comment;
}
