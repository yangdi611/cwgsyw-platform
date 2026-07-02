package com.cwgsyw.platform.common;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * 携带业务 errorCode 与 HTTP 状态的异常。由 GlobalExceptionHandler 映射为
 * {@code R.fail(httpStatus, errorCode, message)}（SPEC 13.6）。
 */
@Getter
public class BusinessException extends RuntimeException {
    private final int httpStatus;
    private final String errorCode;

    public BusinessException(HttpStatus status, String errorCode, String message) {
        this(status.value(), errorCode, message);
    }

    public BusinessException(int httpStatus, String errorCode, String message) {
        super(message);
        this.httpStatus = httpStatus;
        this.errorCode = errorCode;
    }

    public static BusinessException badRequest(String errorCode, String message) {
        return new BusinessException(HttpStatus.BAD_REQUEST, errorCode, message);
    }

    public static BusinessException unauthorized(String errorCode, String message) {
        return new BusinessException(HttpStatus.UNAUTHORIZED, errorCode, message);
    }

    public static BusinessException forbidden(String errorCode, String message) {
        return new BusinessException(HttpStatus.FORBIDDEN, errorCode, message);
    }

    public static BusinessException serviceUnavailable(String errorCode, String message) {
        return new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, errorCode, message);
    }
}
