package com.cwgsyw.platform.module.workflow.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ApproveRequest {
    @NotBlank private String taskId;
    private boolean approved;
    private String comment;
}
