package com.cwgsyw.platform.module.task.runtime.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Read-only value and lineage resolved for one aggregate-reference field. */
public record AggregateReferencePreviewVO(
    String fieldKey,
    Long metricId,
    LocalDate from,
    LocalDate to,
    Long groupId,
    BigDecimal systemValue,
    BigDecimal manualValue,
    BigDecimal difference,
    String selectedSourceRole,
    BigDecimal selectedValue,
    int sourceTaskCount,
    List<Long> factIds,
    List<Long> taskIds,
    List<Long> submissionIds
) {
}
