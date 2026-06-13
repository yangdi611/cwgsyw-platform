package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class CiModelVO {
    private Long id;
    private String modelId;
    private String name;
    private String icon;
    private String groupCode;
    private String description;
    private Boolean isBuiltIn;
    private Boolean isPaused;
    private Integer sortOrder;
    private LocalDateTime createdAt;
    private List<CiAttributeGroupVO> attributeGroups;
    private List<CiAttributeVO> attributes;
}
