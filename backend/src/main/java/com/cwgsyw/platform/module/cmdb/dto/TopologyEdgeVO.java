package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;

@Data
public class TopologyEdgeVO {
    private Long id;
    private Long srcId;
    private Long dstId;
    private String label;
    private String defId;
}
