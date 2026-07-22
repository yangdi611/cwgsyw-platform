package com.cwgsyw.platform.module.ai.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SaveAiProviderConfigRequest {
    @Size(max = 512)
    private String apiKey;
    @Size(max = 2048)
    private String baseUrl;
    @Size(max = 255)
    private String model;
    private Boolean enabled;
    @Size(max = 4096)
    private String systemPrompt;
}
