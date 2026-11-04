package com.cwgsyw.platform.module.sosreport.parser;

import lombok.Getter;

/**
 * 归档本身有问题，重试不会成功。消息是固定文案，不包含归档内容。
 */
@Getter
public class SosParseException extends RuntimeException {

    private final String code;

    public SosParseException(String code, String message) {
        super(message);
        this.code = code;
    }

    public SosParseException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }
}
