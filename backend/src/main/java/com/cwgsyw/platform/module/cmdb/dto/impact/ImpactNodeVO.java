package com.cwgsyw.platform.module.cmdb.dto.impact;

import lombok.Data;

@Data
public class ImpactNodeVO {
    private Long id;
    private String name;
    private String modelId;
    private String modelName;
    private String status;
    private String businessLevel;
}
