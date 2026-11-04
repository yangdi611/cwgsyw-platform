package com.cwgsyw.platform.module.sosreport.mapping;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.ai.AiGatewayService;
import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import com.cwgsyw.platform.module.sosreport.SosTestSupport;
import com.cwgsyw.platform.module.sosreport.dto.SosMappingDtos.SuggestResultVO;
import com.cwgsyw.platform.module.sosreport.entity.SosFieldMapping;
import com.cwgsyw.platform.module.sosreport.mapper.SosFieldMappingMapper;
import com.cwgsyw.platform.security.SecurityUser;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SosMappingSuggestionServiceTest {

    @Mock SosFieldMappingService mappingService;
    @Mock SosFieldMappingMapper mappingMapper;
    @Mock AiGatewayService aiGatewayService;
    @Mock AuditLogMapper auditLogMapper;

    private SosMappingSuggestionService service;
    private final SecurityUser admin = SosTestSupport.user("tenant-a", 7L, "sos_report:manage_mapping");
    private final CiAttribute threads = SosTestSupport.attribute("logical_cores", "int");
    private final CiAttribute rack = SosTestSupport.attribute("rack_location", "singlechar");
    private final CiAttribute cpuBrand = SosTestSupport.enumAttribute("cpu_brand", "hygon", "intel");

    @BeforeEach
    void setUp() {
        SosTestSupport.initTables();
        PlatformTransactionManager transactionManager = mock(PlatformTransactionManager.class);
        when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        service = new SosMappingSuggestionService(mappingService, mappingMapper, aiGatewayService, auditLogMapper,
            new ObjectMapper(), new TransactionTemplate(transactionManager));
        when(mappingService.rows("tenant-a")).thenReturn(new LinkedHashMap<>());
        when(mappingService.attributes("tenant-a")).thenReturn(List.of(threads, rack, cpuBrand));
    }

    private void aiReturns(String response) {
        when(aiGatewayService.generateStructured(anyString(), anyString(), anyString(), anyString(), any(), anyLong()))
            .thenReturn(response);
    }

    private String capturePrompt() {
        ArgumentCaptor<String> prompt = ArgumentCaptor.forClass(String.class);
        verify(aiGatewayService).generateStructured(anyString(), anyString(), prompt.capture(), anyString(), any(), anyLong());
        return prompt.getValue();
    }

    @Test
    void promptContainsOnlyFieldDefinitionsAndCatalog() {
        aiReturns("{\"suggestions\":[]}");

        service.suggest(admin, null);

        String prompt = capturePrompt();
        assertTrue(prompt.contains("logical_cores"));
        assertTrue(prompt.contains("cpu.threads"), "应包含事实目录");
        // 这个类不依赖报告数据，提示词里不可能有主机的值。断言目录里没有值的形态。
        assertFalse(prompt.matches("(?s).*\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\b.*"), "不应出现 IP 地址");
    }

    @Test
    void neverAsksAiAboutBuiltInOrUnsupportedFields() {
        CiAttribute builtIn = SosTestSupport.attribute("env", "singlechar");
        builtIn.setIsBuiltIn(true);
        CiAttribute preset = SosTestSupport.identity("sn");
        preset.setIsBuiltIn(false);

        assertFalse(SosMappingSuggestionService.isEligible(builtIn, null));
        assertFalse(SosMappingSuggestionService.isEligible(preset, null), "预置字段即使标记错误也不发给 AI");
        assertFalse(SosMappingSuggestionService.isEligible(SosTestSupport.attribute("t", "table"), null));
        assertFalse(SosMappingSuggestionService.isEligible(SosTestSupport.attribute("u", "objuser"), null));
        assertTrue(SosMappingSuggestionService.isEligible(threads, null));
    }

    @Test
    void skipsConfirmedAndUnmappableButRetriesStale() {
        SosFieldMapping confirmed = new SosFieldMapping();
        confirmed.setStatus(SosFieldMapping.STATUS_CONFIRMED);
        confirmed.setFieldFingerprint(SosMappingEngine.fingerprint(threads));
        assertFalse(SosMappingSuggestionService.isEligible(threads, confirmed));

        SosFieldMapping stale = new SosFieldMapping();
        stale.setStatus(SosFieldMapping.STATUS_CONFIRMED);
        stale.setFieldFingerprint("old");
        assertTrue(SosMappingSuggestionService.isEligible(threads, stale));

        SosFieldMapping unmappable = new SosFieldMapping();
        unmappable.setStatus(SosFieldMapping.STATUS_UNMAPPABLE);
        assertFalse(SosMappingSuggestionService.isEligible(threads, unmappable));
    }

    @Test
    void savesValidSuggestionsAsSuggestedOnly() {
        aiReturns("""
            {"suggestions":[
              {"fieldKey":"logical_cores","verdict":"mapped","factKey":"cpu.threads","transform":"direct","confidence":0.92,"reason":"逻辑线程"},
              {"fieldKey":"rack_location","verdict":"unmappable","confidence":0.8,"reason":"报告里没有机房信息"},
              {"fieldKey":"cpu_brand","verdict":"ambiguous","confidence":0.4,"reason":"口径不清"}
            ]}
            """);

        SuggestResultVO result = service.suggest(admin, null);

        assertEquals(1, result.getSuggested());
        assertEquals(1, result.getUnmappable());
        assertEquals(1, result.getAmbiguous());
        assertTrue(result.getRejected().isEmpty());

        ArgumentCaptor<SosFieldMapping> saved = ArgumentCaptor.forClass(SosFieldMapping.class);
        verify(mappingMapper, org.mockito.Mockito.times(3)).insert(saved.capture());
        saved.getAllValues().forEach(row -> {
            assertEquals(SosFieldMapping.STATUS_SUGGESTED, row.getStatus(), "AI 建议不能直接生效");
            assertEquals(SosFieldMapping.SOURCE_AI, row.getSource());
            assertEquals("tenant-a", row.getTenantId());
        });
        assertEquals(new BigDecimal("0.920"), saved.getAllValues().get(0).getAiConfidence());
        assertNull(saved.getAllValues().get(1).getFactKey());
    }

    @Test
    void rejectsInvalidSuggestionsIndividually() {
        Map<String, CiAttribute> attributes = Map.of("logical_cores", threads, "rack_location", rack, "cpu_brand", cpuBrand);
        String response = """
            {"suggestions":[
              {"fieldKey":"logical_cores","verdict":"mapped","factKey":"made.up.fact","transform":"direct"},
              {"fieldKey":"rack_location","verdict":"mapped","factKey":"os.kernel","transform":"rm -rf"},
              {"fieldKey":"cpu_brand","verdict":"mapped","factKey":"cpu.vendor","transform":"enum_map","enumMap":{"Hygon":"not-an-option"}},
              {"fieldKey":"sn","verdict":"mapped","factKey":"system.uuid","transform":"direct"}
            ]}
            """;

        SosMappingSuggestionService.ParsedSuggestions parsed = service.parse(response, attributes);

        assertTrue(parsed.accepted().isEmpty());
        assertEquals(4, parsed.rejected().size());
    }

    @Test
    void acceptsEnumMapIntoRealOptions() {
        SosMappingSuggestionService.ParsedSuggestions parsed = service.parse("""
            {"suggestions":[{"fieldKey":"cpu_brand","verdict":"mapped","factKey":"cpu.vendor","transform":"enum_map","enumMap":{"Hygon":"hygon"},"confidence":5}]}
            """, Map.of("cpu_brand", cpuBrand));

        assertEquals(1, parsed.accepted().size());
        assertEquals(new BigDecimal("1.000"), parsed.accepted().get(0).confidence(), "置信度限制在 0-1");
    }

    @Test
    void ignoresDuplicateSuggestionsForTheSameField() {
        SosMappingSuggestionService.ParsedSuggestions parsed = service.parse("""
            {"suggestions":[
              {"fieldKey":"logical_cores","verdict":"unmappable"},
              {"fieldKey":"logical_cores","verdict":"mapped","factKey":"cpu.threads","transform":"direct"}
            ]}
            """, Map.of("logical_cores", threads));

        assertEquals(1, parsed.accepted().size());
        assertEquals(1, parsed.rejected().size());
    }

    @Test
    void acceptsJsonWrappedInCodeFence() {
        SosMappingSuggestionService.ParsedSuggestions parsed = service.parse(
            "```json\n{\"suggestions\":[{\"fieldKey\":\"logical_cores\",\"verdict\":\"unmappable\"}]}\n```",
            Map.of("logical_cores", threads));
        assertEquals(1, parsed.accepted().size());
    }

    @Test
    void reportsUnparseableResponse() {
        assertEquals("SOS_MAPPING_AI_INVALID", assertThrows(BusinessException.class,
            () -> service.parse("抱歉，我无法完成", Map.of())).getErrorCode());
        assertEquals("SOS_MAPPING_AI_INVALID", assertThrows(BusinessException.class,
            () -> service.parse("{\"other\":1}", Map.of())).getErrorCode());
    }

    @Test
    void neverOverwritesConfirmedRulesWithSuggestions() {
        SosFieldMapping confirmed = new SosFieldMapping();
        confirmed.setStatus(SosFieldMapping.STATUS_CONFIRMED);
        confirmed.setFieldKey("logical_cores");
        confirmed.setFieldFingerprint(SosMappingEngine.fingerprint(threads));
        Map<String, SosFieldMapping> rows = new LinkedHashMap<>();
        rows.put("logical_cores", confirmed);
        when(mappingService.rows("tenant-a")).thenReturn(rows);
        when(mappingService.attributes("tenant-a")).thenReturn(List.of(threads));

        BusinessException exception = assertThrows(BusinessException.class, () -> service.suggest(admin, null));

        assertEquals("SOS_MAPPING_NOTHING_TO_SUGGEST", exception.getErrorCode());
        verify(aiGatewayService, never()).generateStructured(any(), any(), any(), any(), any(), any());
    }

    @Test
    void limitsFieldsPerCallAndReportsRemaining() {
        List<CiAttribute> many = new ArrayList<>();
        for (int i = 0; i < SosMappingSuggestionService.MAX_FIELDS_PER_CALL + 5; i++) {
            many.add(SosTestSupport.attribute("custom_" + i, "singlechar"));
        }
        when(mappingService.attributes("tenant-a")).thenReturn(many);
        aiReturns("{\"suggestions\":[]}");

        assertEquals(5, service.suggest(admin, null).getRemaining());
    }

    @Test
    void honorsRequestedFieldKeys() {
        aiReturns("{\"suggestions\":[]}");

        service.suggest(admin, List.of("rack_location"));

        String prompt = capturePrompt();
        assertTrue(prompt.contains("rack_location"));
        assertFalse(prompt.contains("logical_cores"));
    }

    @Test
    void aiFailureDoesNotTouchRules() {
        when(aiGatewayService.generateStructured(any(), any(), any(), any(), any(), any()))
            .thenThrow(new RuntimeException("AI 生成失败: key=secret"));

        BusinessException exception = assertThrows(BusinessException.class, () -> service.suggest(admin, null));

        assertEquals("SOS_MAPPING_AI_FAILED", exception.getErrorCode());
        assertFalse(exception.getMessage().contains("secret"), "不回显上游错误");
        verify(mappingMapper, never()).insert(any(SosFieldMapping.class));
    }

    @Test
    void reportsAiDisabled() {
        when(aiGatewayService.generateStructured(any(), any(), any(), any(), any(), any()))
            .thenThrow(new IllegalStateException("未配置可用的 AI 服务"));

        assertEquals("SOS_MAPPING_AI_UNAVAILABLE",
            assertThrows(BusinessException.class, () -> service.suggest(admin, null)).getErrorCode());
    }
}
