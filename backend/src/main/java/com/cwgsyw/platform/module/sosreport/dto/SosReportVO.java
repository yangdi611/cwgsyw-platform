package com.cwgsyw.platform.module.sosreport.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** 列表不返回 facts；详情返回。 */
@Data
public class SosReportVO {
    private Long id;
    private String fileName;
    private Long fileSize;
    private String status;
    private String errorCode;
    private String errorMessage;
    private String sosVersion;
    private String hostname;
    private String serialNumber;
    private String primaryIp;
    private String systemUuid;
    private String collectedAt;
    private LocalDateTime parsedAt;
    private LocalDateTime createdAt;
    private Long createdBy;
    private String createdByName;
    private List<String> warnings;
    private Map<String, Object> facts;
}
