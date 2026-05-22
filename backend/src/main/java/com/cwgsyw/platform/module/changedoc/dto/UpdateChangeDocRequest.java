package com.cwgsyw.platform.module.changedoc.dto;
import lombok.Data;

@Data
public class UpdateChangeDocRequest {
    private String title;
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
}
