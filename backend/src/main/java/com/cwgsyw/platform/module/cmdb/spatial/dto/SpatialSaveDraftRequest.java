package com.cwgsyw.platform.module.cmdb.spatial.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SpatialSaveDraftRequest {
    @NotNull(message = "草稿版本不能为空")
    @Min(value = 0, message = "草稿版本无效")
    private Integer revision;

    @NotNull(message = "schemaVersion 不能为空")
    private Integer schemaVersion;

    @NotNull(message = "布局文档不能为空")
    @JsonProperty("document")
    private JsonNode document;
}
