package com.cwgsyw.platform.module.task.template;

import lombok.Getter;
import org.springframework.http.HttpStatus;

import java.util.Map;

@Getter
public class TaskTemplateException extends RuntimeException {
    private final HttpStatus status;
    private final String errorCode;
    private final Map<String, Object> details;

    public TaskTemplateException(HttpStatus status, String errorCode, String message) {
        this(status, errorCode, message, Map.of());
    }

    public TaskTemplateException(HttpStatus status, String errorCode, String message, Map<String, Object> details) {
        super(message);
        this.status = status;
        this.errorCode = errorCode;
        this.details = Map.copyOf(details);
    }
}
