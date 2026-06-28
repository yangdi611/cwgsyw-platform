package com.cwgsyw.platform.module.workflow.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ApproveRequest {
    @NotBlank @JsonAlias("task_id") private String taskId;
    private boolean approved;
    private String comment;
}
