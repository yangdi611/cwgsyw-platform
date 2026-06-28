package com.cwgsyw.platform.module.wiki.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

@Data
public class MovePageRequest {
    @JsonAlias("parent_id")  private Long parentId;
    @JsonAlias("sort_order") private int sortOrder;
}
