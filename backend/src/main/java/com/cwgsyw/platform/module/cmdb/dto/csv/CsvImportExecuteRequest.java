package com.cwgsyw.platform.module.cmdb.dto.csv;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CsvImportExecuteRequest {
    @NotBlank
    private String batchId;
}
