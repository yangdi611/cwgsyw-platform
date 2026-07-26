package com.cwgsyw.platform.module.cmdb.spatial.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;

public record SpatialAssetVO(
        @JsonProperty("assetId") Long assetId,
        String originalName,
        String contentType,
        @JsonProperty("byteSize") long byteSize,
        @JsonProperty("pixelWidth") int pixelWidth,
        @JsonProperty("pixelHeight") int pixelHeight,
        LocalDateTime createdAt
) {
}
