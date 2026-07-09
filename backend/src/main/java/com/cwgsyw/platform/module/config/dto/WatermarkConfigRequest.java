package com.cwgsyw.platform.module.config.dto;

import lombok.Data;

@Data
public class WatermarkConfigRequest {
    private String text;
    private Double opacity;
    private String position;
    private Boolean enabled;
}
