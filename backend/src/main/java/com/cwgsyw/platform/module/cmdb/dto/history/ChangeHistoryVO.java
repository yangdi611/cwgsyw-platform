package com.cwgsyw.platform.module.cmdb.dto.history;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
@Data
public class ChangeHistoryVO {
    private Long id;
    private String action;
    private Long operatorId;
    private String operatorName;
    private Map<String, Object> beforeJson;
    private Map<String, Object> afterJson;
    private List<String> changedFields;
    private String summary;
    private LocalDateTime createdAt;
}
