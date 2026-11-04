package com.cwgsyw.platform.module.ai;

import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.cwgsyw.platform.config.CryptoService;
import com.cwgsyw.platform.module.ai.entity.AiCallLog;
import com.cwgsyw.platform.module.ai.entity.AiProviderConfig;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AiGatewayStructuredCallTest {

    @Mock AiProviderConfigMapper configMapper;
    @Mock AiCallLogMapper callLogMapper;
    @Mock CryptoService cryptoService;

    private AiGatewayService service;
    private HttpServer server;
    private final AtomicReference<JsonNode> lastRequest = new AtomicReference<>();

    @BeforeEach
    void setUp() throws IOException {
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), "aiStructuredTest"), AiProviderConfig.class);
        server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        server.createContext("/chat/completions", exchange -> {
            lastRequest.set(new ObjectMapper().readTree(exchange.getRequestBody().readAllBytes()));
            byte[] body = "{\"choices\":[{\"message\":{\"role\":\"assistant\",\"content\":\"ok\"}}],\"usage\":{\"prompt_tokens\":3,\"completion_tokens\":1}}"
                .getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();

        AiProviderConfig config = new AiProviderConfig();
        config.setTenantId("tenant-a");
        config.setProvider("deepseek");
        config.setModel("m");
        config.setApiKeyEnc("enc");
        config.setSystemPrompt("你是变更文档写作助手");
        config.setBaseUrl("http://" + server.getAddress().getHostString() + ":" + server.getAddress().getPort());
        when(configMapper.selectOne(any())).thenReturn(config);
        when(cryptoService.decrypt("enc")).thenReturn("key");
        service = new AiGatewayService(configMapper, callLogMapper, cryptoService);
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    @Test
    void structuredCallUsesCallerSystemPromptAndLowTemperature() {
        assertEquals("ok", service.generateStructured("tenant-a", "只输出 JSON", "问题", "sos_field_mapping", null, 7L));

        JsonNode request = lastRequest.get();
        assertEquals("只输出 JSON", request.path("messages").get(0).path("content").asText());
        assertEquals("system", request.path("messages").get(0).path("role").asText());
        assertEquals("问题", request.path("messages").get(1).path("content").asText());
        assertEquals(0.1, request.path("temperature").asDouble(), 0.0001);
        assertFalse(request.toString().contains("变更文档写作助手"), "不能带上提供商配置的系统提示词");

        ArgumentCaptor<AiCallLog> log = ArgumentCaptor.forClass(AiCallLog.class);
        verify(callLogMapper).insert(log.capture());
        assertEquals("sos_field_mapping", log.getValue().getRefType());
        assertEquals(7L, log.getValue().getOperatorId());
        assertTrue(log.getValue().getSuccess());
    }

    @Test
    void existingGenerateBehaviorIsUnchanged() {
        assertEquals("ok", service.generate("tenant-a", "写文档", "change_doc", 1L, 7L));

        JsonNode request = lastRequest.get();
        assertEquals("你是变更文档写作助手", request.path("messages").get(0).path("content").asText());
        assertEquals(0.7, request.path("temperature").asDouble(), 0.0001);
    }

    @Test
    void reportsAvailability() {
        assertTrue(service.isAvailable("tenant-a"));
        when(configMapper.selectOne(any())).thenReturn(null);
        assertFalse(service.isAvailable("tenant-a"));
        assertThrows(IllegalStateException.class,
            () -> service.generateStructured("tenant-a", "s", "u", "r", null, 7L));
    }
}
