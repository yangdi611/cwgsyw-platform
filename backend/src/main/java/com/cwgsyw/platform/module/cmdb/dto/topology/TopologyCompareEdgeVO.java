package com.cwgsyw.platform.module.cmdb.dto.topology;

import lombok.Data;

@Data
public class TopologyCompareEdgeVO {
    private Long src;
    private Long dst;
    private String kind;
    private String label;
    private String status;
}
