package com.cwgsyw.platform.module.ipam.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class IpAllocationVO {
    private Long id;
    private Long poolId;
    private String ipAddress;
    private String status;
    private Long ciInstanceId;
    private String ciInstanceName;
    private String description;
    private Long allocatedBy;
    private String allocatedByName;
    private LocalDateTime allocatedAt;
    private LocalDateTime releasedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
