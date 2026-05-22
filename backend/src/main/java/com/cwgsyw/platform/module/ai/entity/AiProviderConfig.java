package com.cwgsyw.platform.module.ai.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("ai_provider_config")
public class AiProviderConfig {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String provider;
    private String apiKeyEnc;
    private String baseUrl;
    private String model;
    private Boolean enabled;
    private String systemPrompt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
