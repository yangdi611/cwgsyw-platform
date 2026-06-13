package com.cwgsyw.platform.module.cmdb.dto.model;

import lombok.Data;

@Data
public class UpdateModelRequest {
    private String displayName;
    private String group;
    private String description;
}
