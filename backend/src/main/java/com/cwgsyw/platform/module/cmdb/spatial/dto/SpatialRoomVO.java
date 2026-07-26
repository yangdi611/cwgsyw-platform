package com.cwgsyw.platform.module.cmdb.spatial.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record SpatialRoomVO(
        @JsonProperty("roomInstanceId") Long roomInstanceId,
        String name,
        @JsonProperty("configured") boolean configured,
        @JsonProperty("layoutId") Long layoutId
) {
}
