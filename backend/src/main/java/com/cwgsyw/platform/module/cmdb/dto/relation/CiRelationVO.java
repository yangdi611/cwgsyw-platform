package com.cwgsyw.platform.module.cmdb.dto.relation;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
@Data
public class CiRelationVO {
    private Long id;
    private Long srcInstanceId;
    private String srcInstanceName;
    private Long dstInstanceId;
    private String dstInstanceName;
    private String associationKind;
    private Map<String, Object> metadata;
    private LocalDateTime createdAt;
}
