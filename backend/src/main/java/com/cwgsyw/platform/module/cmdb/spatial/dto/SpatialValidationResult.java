package com.cwgsyw.platform.module.cmdb.spatial.dto;

import java.util.List;

public record SpatialValidationResult(
        int revision,
        boolean valid,
        List<SpatialValidationIssue> errors,
        List<SpatialValidationIssue> warnings
) {
}
