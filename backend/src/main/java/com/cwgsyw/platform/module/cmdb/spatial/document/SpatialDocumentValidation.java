package com.cwgsyw.platform.module.cmdb.spatial.document;

import com.cwgsyw.platform.module.cmdb.spatial.dto.SpatialValidationIssue;
import java.util.List;

public record SpatialDocumentValidation(
        List<SpatialValidationIssue> errors,
        List<SpatialValidationIssue> warnings
) {
    public boolean valid() {
        return errors.isEmpty();
    }
}
