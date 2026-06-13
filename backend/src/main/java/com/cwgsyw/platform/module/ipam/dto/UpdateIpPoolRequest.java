package com.cwgsyw.platform.module.ipam.dto;

import lombok.Data;

@Data
public class UpdateIpPoolRequest {
    private String name;
    private String description;
    private String gateway;
    private String dns;
}
