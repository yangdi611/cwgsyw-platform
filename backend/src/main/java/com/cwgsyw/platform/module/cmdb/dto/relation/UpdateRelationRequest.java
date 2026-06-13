package com.cwgsyw.platform.module.cmdb.dto.relation;

import lombok.Data;

import java.util.Map;

@Data
public class UpdateRelationRequest {
    private Map<String, Object> metadata;
}
