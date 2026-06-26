package com.cwgsyw.platform.module.wiki.dto;

import lombok.Data;

@Data
public class MovePageRequest {
    private Long parentId;
    private int sortOrder;
}
