package com.cwgsyw.platform.module.changedoc.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ApproveRequest {
    @NotNull(message = "审批结果不能为空")
    private Boolean approved;
    private String comment;
}
