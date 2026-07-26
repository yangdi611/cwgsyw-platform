package com.cwgsyw.platform.module.cmdb.spatial.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record SpatialLocateVO(
        @JsonProperty("roomInstanceId") Long roomInstanceId,
        @JsonProperty("roomName") String roomName,
        @JsonProperty("layoutId") Long layoutId,
        @JsonProperty("publishedVersionId") Long publishedVersionId,
        @JsonProperty("elementId") String elementId,
        @JsonProperty("targetCiInstanceId") Long targetCiInstanceId,
        @JsonProperty("targetCiName") String targetCiName,
        @JsonProperty("targetModelId") String targetModelId,
        @JsonProperty("rackCiInstanceId") Long rackCiInstanceId,
        @JsonProperty("rackName") String rackName,
        String pathLabel
) {
}
