package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;

@Data
public class ApproveRequest {
    private Boolean approved;
    private String comment;
}
