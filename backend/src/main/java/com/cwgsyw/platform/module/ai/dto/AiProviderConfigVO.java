package com.cwgsyw.platform.module.ai.dto;

import lombok.Data;

@Data
public class AiProviderConfigVO {
    private String provider;
    private String providerLabel;
    private String baseUrl;
    private String model;
    private Boolean enabled;
    private String systemPrompt;
    private boolean configured;
}
