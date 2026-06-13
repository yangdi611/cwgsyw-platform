package com.cwgsyw.platform.module.cmdb.dto.topology;

import lombok.Data;

import java.util.List;

@Data
public class TopologyCompareVO {
    private List<TopologyNodeV2VO> added;
    private List<TopologyNodeV2VO> removed;
    private List<TopologyNodeV2VO> modified;
    private List<TopologyNodeV2VO> unchanged;
    private List<TopologyCompareEdgeVO> edges;
}
