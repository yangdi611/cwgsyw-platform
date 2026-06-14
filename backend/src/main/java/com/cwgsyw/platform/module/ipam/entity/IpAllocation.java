package com.cwgsyw.platform.module.ipam.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("ip_allocation")
public class IpAllocation extends BaseEntity {
    private Long poolId;
    private String ipAddress;
    private String status;
    private Long ciInstanceId;
    private String description;
    private Long allocatedBy;
    private LocalDateTime allocatedAt;
    private LocalDateTime releasedAt;
}
