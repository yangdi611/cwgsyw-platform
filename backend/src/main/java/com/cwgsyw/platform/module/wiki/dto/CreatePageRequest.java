package com.cwgsyw.platform.module.wiki.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

@Data
public class CreatePageRequest {
    @JsonAlias("space_id")  private Long spaceId;
    @JsonAlias("parent_id") private Long parentId;
    private String title;
}
