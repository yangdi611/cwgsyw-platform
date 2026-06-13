package com.cwgsyw.platform.module.ipam.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("ip_pool")
public class IpPool extends BaseEntity {
    private String name;
    private String description;
    private String cidr;
    private String gateway;
    private String dns;
    private String status;
    private Integer totalCount;
    private Integer allocatedCount;
}
