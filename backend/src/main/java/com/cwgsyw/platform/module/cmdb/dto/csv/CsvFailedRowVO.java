package com.cwgsyw.platform.module.cmdb.dto.csv;

import lombok.Data;

import java.util.Map;

@Data
public class CsvFailedRowVO {
    private int rowNumber;
    private String reason;
    private Map<String, Object> rowData;
}
