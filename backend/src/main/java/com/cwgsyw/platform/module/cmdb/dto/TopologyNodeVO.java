package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;

@Data
public class TopologyNodeVO {
    private Long id;
    private String name;
    private String modelId;
    private String modelName;
    private Boolean isRoot;
}
