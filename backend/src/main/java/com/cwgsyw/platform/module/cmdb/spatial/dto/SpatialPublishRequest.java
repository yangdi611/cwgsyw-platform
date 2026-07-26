package com.cwgsyw.platform.module.cmdb.spatial.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SpatialPublishRequest {
    @NotNull(message = "草稿版本不能为空")
    @Min(value = 0, message = "草稿版本无效")
    private Integer revision;

    @Size(max = 500, message = "发布说明不能超过 500 个字符")
    private String changeSummary;
}
