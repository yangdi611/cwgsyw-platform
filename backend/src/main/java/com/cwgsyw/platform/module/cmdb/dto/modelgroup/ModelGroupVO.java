package com.cwgsyw.platform.module.cmdb.dto.modelgroup;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.time.LocalDateTime;

@JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
@Data
public class ModelGroupVO {
    private Long id;
    private String code;
    private String name;
    private String icon;
    private Integer sortOrder;
    private Boolean isBuiltIn;
    /** Number of models currently in this group (computed; for delete-check + UI badges). */
    private Integer modelCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
