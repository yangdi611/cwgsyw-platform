package com.cwgsyw.platform.module.task.template.dto;

import java.util.Set;

public record FieldTypeMetadata(
    String type,
    String label,
    String category,
    boolean supportsAnalytics,
    boolean supportsDimension,
    boolean supportsSensitive,
    boolean supportsExport,
    Set<String> aggregations
) {
}
