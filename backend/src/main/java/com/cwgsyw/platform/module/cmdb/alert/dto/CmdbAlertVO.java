package com.cwgsyw.platform.module.cmdb.alert.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CmdbAlertVO {
    private Long id;
    private Long ciInstanceId;
    private String ciInstanceName;
    private String alertName;
    private String severity;
    private String status;
    private String summary;
    private String description;
    private LocalDateTime startsAt;
    private LocalDateTime endsAt;
    private Boolean acknowledged;
    private LocalDateTime createdAt;
}
