package com.cwgsyw.platform.module.ai.dto;

import lombok.Data;

@Data
public class SaveAiProviderConfigRequest {
    private String apiKey;
    private String baseUrl;
    private String model;
    private Boolean enabled;
    private String systemPrompt;
}
