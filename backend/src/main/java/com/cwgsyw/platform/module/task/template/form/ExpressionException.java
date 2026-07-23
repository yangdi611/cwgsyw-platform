package com.cwgsyw.platform.module.task.template.form;

public class ExpressionException extends RuntimeException {
    private final String code;
    private final String path;

    public ExpressionException(String code, String path, String message) {
        super(message);
        this.code = code;
        this.path = path;
    }

    public String code() {
        return code;
    }

    public String path() {
        return path;
    }
}
