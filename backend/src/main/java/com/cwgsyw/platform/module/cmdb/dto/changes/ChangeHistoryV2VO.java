package com.cwgsyw.platform.module.cmdb.dto.changes;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
public class ChangeHistoryV2VO {
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
