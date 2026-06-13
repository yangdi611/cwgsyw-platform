package com.cwgsyw.platform.module.cmdb.dto.changes;

import lombok.Data;

@Data
public class TopInstanceVO {
    private Long instanceId;
    private String instanceName;
    private String modelId;
    private String modelName;
    private int changeCount;
}
