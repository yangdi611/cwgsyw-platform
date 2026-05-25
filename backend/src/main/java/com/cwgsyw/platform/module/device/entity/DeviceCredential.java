package com.cwgsyw.platform.module.device.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("device_credential")
public class DeviceCredential extends BaseEntity {
    private Long deviceId;
    private Long groupId;          // which ops group owns this credential
    private String username;
    private String passwordEnc;
    private String description;
}
