package com.cwgsyw.platform.module.cmdb.dto.topology;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.Map;

@Data
public class TopologyNodeV2VO {
    private Long id;
    private String name;

    @JsonProperty("model_id")
    private String modelId;

    @JsonProperty("model_name")
    private String modelName;

    @JsonProperty("model_color")
    private String modelColor;

    private String status;
    private String owner;

    @JsonProperty("is_root")
    private boolean isRoot;

    @JsonProperty("key_attrs")
    private Map<String, Object> keyAttrs;

    /** Fields data snapshot (used by topology compare to detect modifications). */
    private Map<String, Object> fieldsData;
}
