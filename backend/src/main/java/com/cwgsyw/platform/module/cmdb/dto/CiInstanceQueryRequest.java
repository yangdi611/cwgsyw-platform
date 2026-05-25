package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;

@Data
public class CiInstanceQueryRequest {
    private String keyword;   // searches name and key attrs
    private Integer page = 1;
    private Integer size = 20;
}
