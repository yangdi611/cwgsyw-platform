package com.cwgsyw.platform.module.cmdb.spatial.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SpatialCreateLayoutRequest {
    @NotNull(message = "机房不能为空")
    @JsonProperty("roomInstanceId")
    private Long roomInstanceId;

    @NotBlank(message = "布局名称不能为空")
    @Size(max = 128, message = "布局名称不能超过 128 个字符")
    private String name;
}
