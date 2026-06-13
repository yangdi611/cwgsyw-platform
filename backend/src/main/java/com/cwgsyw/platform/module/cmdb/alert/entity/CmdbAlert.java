package com.cwgsyw.platform.module.cmdb.alert.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("cmdb_alert")
public class CmdbAlert extends BaseEntity {
    private Long ciInstanceId;
    private String alertName;
    private String severity;
    private String status;
    private String fingerprint;
    private String summary;
    private String description;
    private LocalDateTime startsAt;
    private LocalDateTime endsAt;
    private String rawLabels;
    private Boolean acknowledged;
    private LocalDateTime acknowledgedAt;
    private Long acknowledgedBy;
}
