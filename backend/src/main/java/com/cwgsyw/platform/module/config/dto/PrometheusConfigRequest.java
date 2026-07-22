package com.cwgsyw.platform.module.config.dto;

import jakarta.validation.constraints.Min;
import lombok.Data;

@Data
public class PrometheusConfigRequest {
    private Boolean enabled;
    private String url;
    @Min(value = 10, message = "Prometheus 同步间隔不能小于 10 秒")
    private Integer scrapeInterval;
}
