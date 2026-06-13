package com.cwgsyw.platform.module.cmdb.dto.topology;

import lombok.Data;

import java.util.Map;

@Data
public class TopologyEdgeVO {
    private Long src;
    private Long dst;
    private String kind;
    private String label;
    private Map<String, Object> metadata;
}
