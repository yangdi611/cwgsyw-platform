package com.cwgsyw.platform.module.cmdb.dto.history;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@Data
public class ChangeHistoryVO {
    private Long id;
    private String action;
    private Long operatorId;
    private String operatorName;
    private Map<String, Object> beforeJson;
    private Map<String, Object> afterJson;
    private LocalDateTime createdAt;
}
