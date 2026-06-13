package com.cwgsyw.platform.module.device.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateDeviceRequest {
    @NotBlank private String name;
    private String ip;
    private String deviceType;
    private String category;
    private String description;
    private Long groupId;
    private Long ciInstanceId;
}
