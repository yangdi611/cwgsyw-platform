package com.cwgsyw.platform.module.cmdb.dto.csv;

import lombok.Data;

import java.util.List;

@Data
public class CsvImportResultVO {
    private String batchId;
    private int totalRows;
    private int created;
    private int updated;
    private int skipped;
    private int failed;
    private List<CsvFailedRowVO> failedRows;
    private long durationMs;
}
