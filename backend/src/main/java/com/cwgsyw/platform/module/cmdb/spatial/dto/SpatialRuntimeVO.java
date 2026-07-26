package com.cwgsyw.platform.module.cmdb.spatial.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;
import java.util.Map;

public record SpatialRuntimeVO(
        @JsonProperty("layoutId") Long layoutId,
        @JsonProperty("publishedVersionId") Long publishedVersionId,
        LocalDateTime generatedAt,
        Map<String, SpatialRuntimeElementVO> elements,
        boolean partial
) {
}
