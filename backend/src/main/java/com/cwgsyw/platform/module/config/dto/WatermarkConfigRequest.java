package com.cwgsyw.platform.module.config.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class WatermarkConfigRequest {
    private String text;
    @DecimalMin(value = "0.0", message = "水印透明度不能小于 0")
    @DecimalMax(value = "1.0", message = "水印透明度不能大于 1")
    private Double opacity;
    @Min(value = -180, message = "水印角度不能小于 -180")
    @Max(value = 180, message = "水印角度不能大于 180")
    private Integer angle;
    @Pattern(
        regexp = "^(top-left|top-right|bottom-left|bottom-right|center)$",
        message = "水印位置不合法"
    )
    private String position;
    private Boolean enabled;
}
