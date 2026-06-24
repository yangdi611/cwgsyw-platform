package com.cwgsyw.platform.module.backup.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class BackupRecordVO {
    private Long id;
    private String fileName;
    private Long fileSizeBytes;
    private String status;
    private String backupType;
    private String errorMessage;
    private Long createdBy;
    private String createdByName;
    private LocalDateTime createdAt;
}
