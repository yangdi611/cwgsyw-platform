package com.cwgsyw.platform.module.cmdb.dto.impact;

import lombok.Data;

@Data
public class ImpactEdgeVO {
    private Long src;
    private Long dst;
    private String kind;
    private String label;
}
