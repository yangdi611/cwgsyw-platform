package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;
import java.util.List;

@Data
public class CiTopologyResultVO {
    private List<TopoNode> nodes;
    private List<TopoEdge> edges;

    @Data
    public static class TopoNode {
        private Long id;
        private String name;
        private String modelId;
        private String modelName;
        private boolean isRoot;
    }

    @Data
    public static class TopoEdge {
        private Long id;
        private Long srcId;
        private Long dstId;
        private String label;
        private String defId;
    }
}
