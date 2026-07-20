package com.cwgsyw.platform.module.ai;

import com.cwgsyw.platform.config.CryptoService;
import com.cwgsyw.platform.module.ai.dto.SaveAiProviderConfigRequest;
import com.cwgsyw.platform.module.ai.entity.AiProviderConfig;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiProviderConfigValidationTest {
    @Mock AiProviderConfigMapper configMapper;
    @Mock AiCallLogMapper callLogMapper;
    @Mock CryptoService cryptoService;

    private AiGatewayService service;

    @BeforeEach
    void setUp() {
        TableInfoHelper.initTableInfo(
                new MapperBuilderAssistant(new MybatisConfiguration(), "aiProviderConfigValidationTest"),
                AiProviderConfig.class);
        service = new AiGatewayService(configMapper, callLogMapper, cryptoService);
        AiProviderConfig existing = new AiProviderConfig();
        existing.setProvider("deepseek");
        when(configMapper.findByTenantAndProvider("default", "deepseek")).thenReturn(existing);
    }

    @Test
    void rejectsInvalidUrlsBeforeAnyWrite() {
        for (String value : new String[]{"", "not a url", "ftp://example.test", "https:///missing-host"}) {
            SaveAiProviderConfigRequest request = request(value, "model");
            assertThatThrownBy(() -> service.saveProviderConfig("default", "deepseek", request))
                    .isInstanceOf(IllegalArgumentException.class);
        }
        verify(configMapper, never()).update(any(), any());
    }

    @Test
    void rejectsBlankModelBeforeAnyWrite() {
        SaveAiProviderConfigRequest request = request("https://example.test/v1", "   ");

        assertThatThrownBy(() -> service.saveProviderConfig("default", "deepseek", request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("模型不能为空");
        verify(configMapper, never()).update(any(), any());
    }

    @Test
    void normalizesValidUrlAndModel() {
        SaveAiProviderConfigRequest request = request("  https://example.test/v1///  ", "  model-name  ");

        service.saveProviderConfig("default", "deepseek", request);

        verify(configMapper).update(any(), any());
    }

    private SaveAiProviderConfigRequest request(String baseUrl, String model) {
        SaveAiProviderConfigRequest request = new SaveAiProviderConfigRequest();
        request.setBaseUrl(baseUrl);
        request.setModel(model);
        return request;
    }
}
