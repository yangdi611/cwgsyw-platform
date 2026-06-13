package com.cwgsyw.platform.module.cmdb.dto.impact;

import lombok.Data;

import java.util.List;

@Data
public class ImpactAnalysisResultVO {
    private Long rootId;
    private String rootName;
    private String rootModelId;
    private String direction;
    private int maxDepth;
    private boolean truncated;
    private List<ImpactLayerVO> layers;
    private List<ImpactEdgeVO> edges;
}
