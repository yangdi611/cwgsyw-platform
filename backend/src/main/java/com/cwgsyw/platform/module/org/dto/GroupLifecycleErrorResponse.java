package com.cwgsyw.platform.module.org.dto;

import lombok.Data;

@Data
public class GroupLifecycleErrorResponse {
    private final int code;
    private final String errorCode;
    private final String message;
    private final GroupLifecyclePreflightVO data;
}
