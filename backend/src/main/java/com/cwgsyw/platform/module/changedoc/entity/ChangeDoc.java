package com.cwgsyw.platform.module.changedoc.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("change_doc")
public class ChangeDoc {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String changeNo;
    private String title;
    private String status;           // draft | pending | approved | rejected
    private Long applicantId;
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
    private String approverComment;
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime deletedAt;
    private Long deletedBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long createdBy;
}
