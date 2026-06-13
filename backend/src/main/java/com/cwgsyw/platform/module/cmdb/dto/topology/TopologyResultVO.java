package com.cwgsyw.platform.module.cmdb.dto.topology;

import lombok.Data;

import java.util.List;

@Data
public class TopologyResultVO {
    private List<TopologyNodeVO> nodes;
    private List<TopologyEdgeVO> edges;
}
