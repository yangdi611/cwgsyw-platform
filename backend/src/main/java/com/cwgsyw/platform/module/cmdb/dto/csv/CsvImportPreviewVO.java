package com.cwgsyw.platform.module.cmdb.dto.csv;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class CsvImportPreviewVO {
    private String batchId;
    private int totalRows;
    private int toCreate;
    private int toUpdate;
    private int toSkip;
    private List<CsvFailedRowVO> failedRows;
    private String encoding;
    private List<Map<String, Object>> previewData;
}
