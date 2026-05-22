package com.cwgsyw.platform.module.ai.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("ai_call_log")
public class AiCallLog {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String provider;
    private String model;
    private Integer promptTokens;
    private Integer completionTokens;
    private Integer durationMs;
    private Boolean success;
    private String errorMsg;
    private String refType;
    private Long refId;
    private Long operatorId;
    private LocalDateTime createdAt;
}
