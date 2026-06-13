package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.Map;

@Data
public class CiInstanceSearchVO {
    private Long id;
    private String name;
    private String modelId;
    private String modelName;
    private Map<String, Object> attrs;
    private LocalDateTime updatedAt;
}
