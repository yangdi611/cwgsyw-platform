package com.cwgsyw.platform.module.task.automation.dto;

import java.util.Map;

public record AutomationPreviewVO(boolean matched, String reason, Map<String, Object> resolvedAction) {}
