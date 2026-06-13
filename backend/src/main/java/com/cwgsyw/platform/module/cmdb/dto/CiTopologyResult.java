package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;
import java.util.List;

@Data
public class CiTopologyResult {
    private List<TopologyNodeVO> nodes;
    private List<TopologyEdgeVO> edges;
}
