package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
public class CiInstanceVO {
    private Long id;
    private String modelId;
    private String modelName;
    private String name;
    private Map<String, Object> attrs;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long createdBy;
    private String createdByName;
    // Field config included so frontend can render detail page without extra metadata call
    private List<CiAttributeVO> fieldConfig;
}
