package com.cwgsyw.platform.module.cmdb.dto.topology;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class TopologyNodeVO {
    private Long id;
    private String name;

    @JsonProperty("model_id")
    private String modelId;

    @JsonProperty("model_name")
    private String modelName;

    @JsonProperty("is_root")
    private boolean isRoot;
}
