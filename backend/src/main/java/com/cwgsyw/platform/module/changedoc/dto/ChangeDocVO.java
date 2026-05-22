package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class ChangeDocVO {
    private Long id;
    private String changeNo;
    private String title;
    private String status;
    private Long applicantId;
    private String applicantName;
    private LocalDateTime applyTime;
    private String changeDesc;
    private String impactScope;
    private String changeWindow;
    private String resourceSupport;
    private String background;
    private String steps;
    private String riskAssessment;
    private String rollbackPlan;
    private String verifyMethod;
    private String contacts;
    private LocalDateTime approvedAt;
    private Long approverId;
    private String approverName;
    private String approverComment;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
