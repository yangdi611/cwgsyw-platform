package com.cwgsyw.platform.module.cmdb.dto.attributegroup;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.time.LocalDateTime;

@JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
@Data
public class AttributeGroupVO {
    private Long id;
    /** Group code, e.g. "base" — stored in the {@code group_id} column. */
    private String groupId;
    private String name;
    private Integer sortOrder;
    private Boolean isBuiltIn;
    /** Number of attributes currently in this group (for delete-check + UI). */
    private Integer attributeCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
