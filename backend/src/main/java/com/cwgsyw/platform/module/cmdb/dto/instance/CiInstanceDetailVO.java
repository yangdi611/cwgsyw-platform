package com.cwgsyw.platform.module.cmdb.dto.instance;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.cwgsyw.platform.module.cmdb.dto.attribute.CiAttributeVO;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
@Data
public class CiInstanceDetailVO {
    private Long id;
    private String name;
    private String modelCode;  // canonical (AD-4)
    private String modelId;    // alias of modelCode (compat window)
    private String displayName; // canonical model display name
    private String modelName;
    private String status;
    private String owner;
    private String description;
    private Map<String, Object> fieldsData;
    private List<CiAttributeVO> attributes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
