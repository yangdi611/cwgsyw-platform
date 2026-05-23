package com.cwgsyw.platform.module.audit.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class AuditLogVO {
    private Long id;
    private String module;
    private String action;
    private Long targetId;
    private String targetType;
    private Long operatorId;
    private String operatorName;
    private String operatorIp;
    private String remark;
    private LocalDateTime createdAt;
}
