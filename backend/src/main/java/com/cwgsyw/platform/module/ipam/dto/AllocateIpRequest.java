package com.cwgsyw.platform.module.ipam.dto;

import lombok.Data;

@Data
public class AllocateIpRequest {
    private String ipAddress;
    private Long ciInstanceId;
    private String description;
}
