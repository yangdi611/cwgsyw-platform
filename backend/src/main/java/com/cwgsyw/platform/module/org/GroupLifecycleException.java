package com.cwgsyw.platform.module.org;

import com.cwgsyw.platform.module.org.dto.GroupLifecyclePreflightVO;
import lombok.Getter;

@Getter
public class GroupLifecycleException extends RuntimeException {
    private final int httpStatus;
    private final String errorCode;
    private final GroupLifecyclePreflightVO preflight;

    public GroupLifecycleException(int httpStatus, String errorCode, String message) {
        this(httpStatus, errorCode, message, null);
    }

    public GroupLifecycleException(int httpStatus, String errorCode, String message,
                                   GroupLifecyclePreflightVO preflight) {
        super(message);
        this.httpStatus = httpStatus;
        this.errorCode = errorCode;
        this.preflight = preflight;
    }
}
