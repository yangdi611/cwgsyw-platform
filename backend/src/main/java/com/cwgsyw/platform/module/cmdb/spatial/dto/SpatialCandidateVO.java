package com.cwgsyw.platform.module.cmdb.spatial.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record SpatialCandidateVO(
        @JsonProperty("ciInstanceId") Long ciInstanceId,
        String name,
        @JsonProperty("modelId") String modelId,
        String status,
        boolean bound
) {
}
