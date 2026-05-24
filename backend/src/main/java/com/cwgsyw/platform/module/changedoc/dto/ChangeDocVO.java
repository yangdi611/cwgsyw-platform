package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
public class ChangeDocVO {
    private Long id;
    private String changeNo;
    private String status;
    private Long templateId;
    private String templateName;
    private Long applicantId;
    private String applicantName;
    private LocalDateTime applyTime;
    private LocalDateTime approvedAt;
    private Long approverId;
    private String approverName;
    private String approverComment;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Map<String, String> fieldsData;
    private List<FieldConfigVO> fieldConfig;
}
