package com.cwgsyw.platform.module.cmdb.dto.csv;

import lombok.Data;

@Data
public class CsvImportProgressVO {
    private String batchId;
    private String status;
    private int totalRows;
    private int processed;
    private int created;
    private int updated;
    private int skipped;
    private int failed;
}
