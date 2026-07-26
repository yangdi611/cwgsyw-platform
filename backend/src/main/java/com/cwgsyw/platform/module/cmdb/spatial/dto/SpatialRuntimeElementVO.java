package com.cwgsyw.platform.module.cmdb.spatial.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record SpatialRuntimeElementVO(
        @JsonProperty("ciInstanceId") Long ciInstanceId,
        @JsonProperty("ciName") String ciName,
        @JsonProperty("ciModelId") String ciModelId,
        @JsonProperty("ciStatus") String ciStatus,
        @JsonProperty("activeAlertCount") long activeAlertCount,
        String highestSeverity,
        SpatialRackSummary rack,
        List<String> qualityIssues
) {
    public record SpatialRackSummary(
            @JsonProperty("heightU") int heightU,
            @JsonProperty("usedU") int usedU,
            @JsonProperty("freeU") int freeU,
            @JsonProperty("deviceCount") int deviceCount
    ) { }
}
