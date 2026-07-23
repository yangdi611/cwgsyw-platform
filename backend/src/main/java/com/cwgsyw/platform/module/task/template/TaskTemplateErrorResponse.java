package com.cwgsyw.platform.module.task.template;

import java.util.Map;

public record TaskTemplateErrorResponse(String code, String message, Map<String, Object> details) {
}
