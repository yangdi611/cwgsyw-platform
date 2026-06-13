package com.cwgsyw.platform.module.device.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("device")
public class Device extends BaseEntity {
    private Long groupId;
    private String name;
    private String ip;
    private String deviceType;   // server / network / security / cloud / other
    private String category;
    private String description;
    private Long ciInstanceId;
}
