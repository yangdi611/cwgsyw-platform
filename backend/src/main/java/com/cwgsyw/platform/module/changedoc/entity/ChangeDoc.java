package com.cwgsyw.platform.module.changedoc.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.annotation.TableField;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName(value = "change_doc", autoResultMap = true)
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

    private Long templateId;

    @TableField(typeHandler = com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler.class)
    private java.util.Map<String, String> fieldsData;
}
