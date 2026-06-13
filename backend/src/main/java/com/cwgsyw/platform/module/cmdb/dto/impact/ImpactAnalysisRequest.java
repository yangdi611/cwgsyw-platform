package com.cwgsyw.platform.module.cmdb.dto.impact;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class ImpactAnalysisRequest {
    @Pattern(regexp = "^(upstream|downstream|both)$", message = "direction must be upstream, downstream, or both")
    private String direction = "both";

    @Min(1)
    @Max(10)
    private Integer maxDepth = 3;
}
