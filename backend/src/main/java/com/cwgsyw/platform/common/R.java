package com.cwgsyw.platform.common;

import lombok.Data;

@Data
public class R<T> {
    private int code;
    /** 业务错误码（如 SESSION_TIMEOUT / PASSWORD_REUSED），成功响应为 null。见 SPEC 13.6。 */
    private String errorCode;
    private String message;
    private T data;

    public static <T> R<T> ok(T data) {
        R<T> r = new R<>();
        r.code = 200;
        r.message = "success";
        r.data = data;
        return r;
    }

    public static <T> R<T> ok() {
        return ok(null);
    }

    public static <T> R<T> fail(int code, String message) {
        R<T> r = new R<>();
        r.code = code;
        r.message = message;
        return r;
    }

    public static <T> R<T> fail(String message) {
        return fail(500, message);
    }

    /** 带业务错误码的失败响应。 */
    public static <T> R<T> fail(int code, String errorCode, String message) {
        R<T> r = new R<>();
        r.code = code;
        r.errorCode = errorCode;
        r.message = message;
        return r;
    }
}
