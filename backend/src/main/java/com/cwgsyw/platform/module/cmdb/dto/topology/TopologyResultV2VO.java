package com.cwgsyw.platform.module.cmdb.dto.topology;

import lombok.Data;

import java.util.List;

@Data
public class TopologyResultV2VO {
    private List<TopologyNodeVO> nodes;
    private List<TopologyEdgeVO> edges;
}
