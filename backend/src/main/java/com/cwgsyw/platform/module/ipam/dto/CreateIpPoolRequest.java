package com.cwgsyw.platform.module.ipam.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateIpPoolRequest {
    @NotBlank
    private String name;
    private String description;
    @NotBlank
    private String cidr;
    private String gateway;
    private String dns;
}
