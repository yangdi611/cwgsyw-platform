package com.cwgsyw.platform.module.cmdb.spatial.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;

public record SpatialLayoutVO(
        @JsonProperty("layoutId") Long layoutId,
        @JsonProperty("roomInstanceId") Long roomInstanceId,
        String name,
        String status,
        @JsonProperty("draftVersionId") Long draftVersionId,
        @JsonProperty("publishedVersionId") Long publishedVersionId,
        LocalDateTime updatedAt
) {
}
