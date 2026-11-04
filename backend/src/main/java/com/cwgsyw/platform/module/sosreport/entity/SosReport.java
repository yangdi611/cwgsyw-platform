package com.cwgsyw.platform.module.sosreport.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName(value = "sos_report", autoResultMap = true)
public class SosReport extends BaseEntity {
    public static final String STATUS_PENDING = "pending";
    public static final String STATUS_PARSING = "parsing";
    public static final String STATUS_PARSED = "parsed";
    public static final String STATUS_FAILED = "failed";

    private String fileName;
    private Long fileSize;
    private String contentSha256;
    private String objectKey;
    private String status;
    private Integer attemptCount;
    private LocalDateTime nextAttemptAt;
    private String errorCode;
    private String errorMessage;
    private Integer parserVersion;
    private String sosVersion;
    private String hostname;
    private String serialNumber;
    private String primaryIp;
    private String systemUuid;
    private String collectedAt;
    private LocalDateTime parsedAt;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> facts;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> warnings;
}
