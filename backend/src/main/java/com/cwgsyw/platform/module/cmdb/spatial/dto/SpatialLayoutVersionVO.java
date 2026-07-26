package com.cwgsyw.platform.module.cmdb.spatial.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import java.time.LocalDateTime;

public record SpatialLayoutVersionVO(
        @JsonProperty("versionId") @JsonSerialize(using = ToStringSerializer.class) Long versionId,
        @JsonProperty("layoutId") Long layoutId,
        String state,
        @JsonProperty("versionNo") Integer versionNo,
        int revision,
        @JsonProperty("schemaVersion") int schemaVersion,
        JsonNode document,
        String checksum,
        @JsonProperty("elementCount") int elementCount,
        @JsonProperty("sourceVersionId") @JsonSerialize(using = ToStringSerializer.class) Long sourceVersionId,
        String changeSummary,
        LocalDateTime publishedAt,
        LocalDateTime updatedAt
) {
}
