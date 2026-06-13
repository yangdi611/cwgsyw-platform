package com.cwgsyw.platform.module.ipam.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class IpPoolDetailVO {
    private Long id;
    private String name;
    private String description;
    private String cidr;
    private String gateway;
    private String dns;
    private String status;
    private Integer totalCount;
    private Integer allocatedCount;
    private Double utilizationPercent;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<IpAllocationVO> allocations;
}
