package com.cwgsyw.platform.module.ai;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.cwgsyw.platform.config.CryptoService;
import com.cwgsyw.platform.module.ai.dto.AiProviderConfigVO;
import com.cwgsyw.platform.module.ai.dto.SaveAiProviderConfigRequest;
import com.cwgsyw.platform.module.ai.entity.AiCallLog;
import com.cwgsyw.platform.module.ai.entity.AiProviderConfig;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiGatewayService {
    private final AiProviderConfigMapper configMapper;
    private final AiCallLogMapper callLogMapper;
    private final CryptoService cryptoService;

    private final RestClient restClient = RestClient.create();

    private static final Map<String, String> PROVIDER_LABELS = Map.of(
        "kimi",     "Kimi（月之暗面）",
        "deepseek", "DeepSeek",
        "glm",      "智谱 GLM"
    );

    /** Called by Phase 3b (change documents) to generate AI content. */
    public String generate(String tenantId, String userPrompt, String refType, Long refId, Long operatorId) {
        AiProviderConfig config = configMapper.selectOne(
            new LambdaQueryWrapper<AiProviderConfig>()
                .eq(AiProviderConfig::getTenantId, tenantId)
                .eq(AiProviderConfig::getEnabled, true)
                .orderByAsc(AiProviderConfig::getProvider)
                .last("LIMIT 1"));
        if (config == null) {
            throw new IllegalStateException("未配置可用的 AI 服务，请联系管理员在系统配置中启用 AI 提供商");
        }
        return callWithLogging(config, userPrompt, refType, refId, operatorId);
    }

    /** Called by AiConfigController to test a specific provider. */
    public String testProvider(String tenantId, String provider) {
        AiProviderConfig config = configMapper.findByTenantAndProvider(tenantId, provider);
        if (config == null || config.getApiKeyEnc() == null || config.getApiKeyEnc().isBlank()) {
            throw new IllegalStateException("该 AI 服务未配置 API Key");
        }
        return callWithLogging(config, "请用一句话介绍你自己", "test", null, null);
    }

    /** Called by AiConfigController to save/update a provider config. */
    public void saveProviderConfig(String tenantId, String provider, SaveAiProviderConfigRequest req) {
        AiProviderConfig existing = configMapper.findByTenantAndProvider(tenantId, provider);
        if (existing == null) {
            throw new IllegalStateException("Provider not found: " + provider);
        }
        LambdaUpdateWrapper<AiProviderConfig> update = new LambdaUpdateWrapper<AiProviderConfig>()
            .eq(AiProviderConfig::getTenantId, tenantId)
            .eq(AiProviderConfig::getProvider, provider)
            .set(AiProviderConfig::getUpdatedAt, LocalDateTime.now());
        if (req.getApiKey() != null && !req.getApiKey().isBlank() && !req.getApiKey().startsWith("••")) {
            update.set(AiProviderConfig::getApiKeyEnc, cryptoService.encrypt(req.getApiKey()));
        }
        if (req.getBaseUrl() != null)      update.set(AiProviderConfig::getBaseUrl, req.getBaseUrl());
        if (req.getModel() != null)        update.set(AiProviderConfig::getModel, req.getModel());
        if (req.getEnabled() != null)      update.set(AiProviderConfig::getEnabled, req.getEnabled());
        if (req.getSystemPrompt() != null) update.set(AiProviderConfig::getSystemPrompt, req.getSystemPrompt());
        configMapper.update(null, update);
    }

    /** Returns VO list for all providers — API keys are never included. */
    public List<AiProviderConfigVO> listProviders(String tenantId) {
        List<AiProviderConfig> configs = configMapper.findByTenant(tenantId);
        List<AiProviderConfigVO> result = new ArrayList<>();
        for (AiProviderConfig c : configs) {
            AiProviderConfigVO vo = new AiProviderConfigVO();
            vo.setProvider(c.getProvider());
            vo.setProviderLabel(PROVIDER_LABELS.getOrDefault(c.getProvider(), c.getProvider()));
            vo.setBaseUrl(c.getBaseUrl());
            vo.setModel(c.getModel());
            vo.setEnabled(c.getEnabled());
            vo.setSystemPrompt(c.getSystemPrompt());
            vo.setConfigured(c.getApiKeyEnc() != null && !c.getApiKeyEnc().isBlank());
            result.add(vo);
        }
        return result;
    }

    private String callWithLogging(AiProviderConfig config, String userPrompt,
                                    String refType, Long refId, Long operatorId) {
        long start = System.currentTimeMillis();
        boolean success = true;
        String errorMsg = null;
        int promptTokens = 0, completionTokens = 0;
        String result = null;
        try {
            String apiKey = cryptoService.decrypt(config.getApiKeyEnc());
            ChatResponse resp = callProvider(config, apiKey, userPrompt);
            ChatChoice choice = resp.getChoices().get(0);
            if (choice == null || choice.getMessage() == null || choice.getMessage().getContent() == null) {
                throw new IllegalStateException("AI provider returned empty content");
            }
            result = choice.getMessage().getContent();
            if (resp.getUsage() != null) {
                promptTokens     = resp.getUsage().getPromptTokens();
                completionTokens = resp.getUsage().getCompletionTokens();
            }
        } catch (Exception e) {
            success = false;
            errorMsg = e.getMessage();
            log.error("AI call failed provider={}: {}", config.getProvider(), e.getMessage());
            throw new RuntimeException("AI 生成失败: " + e.getMessage(), e);
        } finally {
            AiCallLog callLog = new AiCallLog();
            callLog.setTenantId(config.getTenantId());
            callLog.setProvider(config.getProvider());
            callLog.setModel(config.getModel());
            callLog.setPromptTokens(promptTokens);
            callLog.setCompletionTokens(completionTokens);
            callLog.setDurationMs((int)(System.currentTimeMillis() - start));
            callLog.setSuccess(success);
            callLog.setErrorMsg(errorMsg);
            callLog.setRefType(refType);
            callLog.setRefId(refId);
            callLog.setOperatorId(operatorId);
            callLog.setCreatedAt(LocalDateTime.now());
            callLogMapper.insert(callLog);
        }
        return result;
    }

    private ChatResponse callProvider(AiProviderConfig config, String apiKey, String userPrompt) {
        List<ChatMessage> messages = new ArrayList<>();
        if (config.getSystemPrompt() != null && !config.getSystemPrompt().isBlank()) {
            messages.add(new ChatMessage("system", config.getSystemPrompt()));
        }
        messages.add(new ChatMessage("user", userPrompt));

        ChatRequest req = new ChatRequest(config.getModel(), messages, 0.7);

        return restClient
            .post()
            .uri(config.getBaseUrl() + "/chat/completions")
            .header("Authorization", "Bearer " + apiKey)
            .contentType(MediaType.APPLICATION_JSON)
            .body(req)
            .retrieve()
            .body(ChatResponse.class);
    }

    // ── Inner DTOs for OpenAI-compatible API ──────────────────────────────────

    @Data @AllArgsConstructor @NoArgsConstructor
    static class ChatRequest {
        private String model;
        private List<ChatMessage> messages;
        private double temperature;
    }

    @Data @AllArgsConstructor @NoArgsConstructor
    static class ChatMessage {
        private String role;
        private String content;
    }

    @Data
    static class ChatResponse {
        private List<ChatChoice> choices;
        private ChatUsage usage;
    }

    @Data
    static class ChatChoice {
        private ChatMessage message;
    }

    @Data
    static class ChatUsage {
        @JsonProperty("prompt_tokens")
        private int promptTokens;
        @JsonProperty("completion_tokens")
        private int completionTokens;
    }
}
