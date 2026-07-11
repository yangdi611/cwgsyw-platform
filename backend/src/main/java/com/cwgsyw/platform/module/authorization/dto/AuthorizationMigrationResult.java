package com.cwgsyw.platform.module.authorization.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AuthorizationMigrationResult {
    private String runId;
    private long sourceCount;
    private long migratedCount;
    private long skippedCount;
    private long errorCount;
    private String status;
}
