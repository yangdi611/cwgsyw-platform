package com.cwgsyw.platform.module.cmdb.dto.impact;

import lombok.Data;

@Data
public class ImpactAnalysisRequest {
    private String direction = "bidirectional";
    private Integer maxDepth = 3;
}
