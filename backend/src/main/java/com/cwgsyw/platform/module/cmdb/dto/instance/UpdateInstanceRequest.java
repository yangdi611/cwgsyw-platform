package com.cwgsyw.platform.module.cmdb.dto.instance;

import lombok.Data;

import java.util.Map;

@Data
public class UpdateInstanceRequest {
    private String name;
    private String status;
    private String owner;
    private String description;
    private Map<String, Object> fieldsData;
}
