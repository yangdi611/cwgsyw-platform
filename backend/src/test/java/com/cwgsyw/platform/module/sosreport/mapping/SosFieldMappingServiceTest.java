package com.cwgsyw.platform.module.sosreport.mapping;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.ai.AiGatewayService;
import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import com.cwgsyw.platform.module.cmdb.mapper.CiAttributeMapper;
import com.cwgsyw.platform.module.sosreport.SosTestSupport;
import com.cwgsyw.platform.module.sosreport.dto.SosMappingDtos.MappingOverviewVO;
import com.cwgsyw.platform.module.sosreport.dto.SosMappingDtos.SaveMappingRequest;
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

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SosFieldMappingServiceTest {

    @Mock SosFieldMappingMapper mappingMapper;
    @Mock CiAttributeMapper attributeMapper;
    @Mock AuditLogMapper auditLogMapper;
    @Mock AiGatewayService aiGatewayService;

    private SosFieldMappingService service;
    private final SecurityUser admin = SosTestSupport.user("tenant-a", 7L, "sos_report:manage_mapping");
    private final List<SosFieldMapping> stored = new ArrayList<>();
    private CiAttribute cores;

    @BeforeEach
    void setUp() {
        SosTestSupport.initTables();
        service = new SosFieldMappingService(mappingMapper, attributeMapper, auditLogMapper, aiGatewayService, new ObjectMapper());
        cores = SosTestSupport.attribute("logical_cores", "int");
        when(attributeMapper.listByModel(SosPresetRules.MODEL_CODE, "tenant-a"))
            .thenReturn(List.of(SosTestSupport.identity("sn"), cores, SosTestSupport.attribute("rack_note", "singlechar")));
        when(mappingMapper.selectList(any())).thenAnswer(invocation -> stored);
    }

    private SosFieldMapping row(String key, String status, CiAttribute attribute) {
        SosFieldMapping row = new SosFieldMapping();
        row.setId(1L);
        row.setTenantId("tenant-a");
        row.setModelCode(SosPresetRules.MODEL_CODE);
        row.setFieldKey(key);
        row.setStatus(status);
        row.setSource(SosFieldMapping.SOURCE_MANUAL);
        row.setFactKey("cpu.threads");
        row.setTransform("direct");
        row.setFieldFingerprint(SosMappingEngine.fingerprint(attribute));
        stored.add(row);
        return row;
    }

    private static SaveMappingRequest confirm(String factKey, String transform) {
        SaveMappingRequest request = new SaveMappingRequest();
        request.setStatus(SosFieldMapping.STATUS_CONFIRMED);
        request.setFactKey(factKey);
        request.setTransform(transform);
        return request;
    }

    private Map<String, SosRule> resolved() {
        return service.resolve("tenant-a", attributeMapper.listByModel(SosPresetRules.MODEL_CODE, "tenant-a"));
    }

    @Test
    void presetAppliesWithoutAnyRow() {
        assertEquals("system.serialNumber", resolved().get("sn").factKey());
    }

    @Test
    void confirmedRuleIsEffective() {
        row("logical_cores", SosFieldMapping.STATUS_CONFIRMED, cores);
        assertEquals("cpu.threads", resolved().get("logical_cores").factKey());
    }

    @Test
    void aiSuggestionNeverTakesEffect() {
        SosFieldMapping suggestion = row("logical_cores", SosFieldMapping.STATUS_SUGGESTED, cores);
        suggestion.setSource(SosFieldMapping.SOURCE_AI);
        assertFalse(resolved().containsKey("logical_cores"));
    }

    @Test
    void ruleBecomesStaleWhenFieldTypeChanges() {
        row("logical_cores", SosFieldMapping.STATUS_CONFIRMED, SosTestSupport.attribute("logical_cores", "singlechar"));

        assertFalse(resolved().containsKey("logical_cores"));
        MappingOverviewVO overview = service.overview("tenant-a");
        assertEquals("stale", overview.getFields().stream()
            .filter(field -> field.getFieldKey().equals("logical_cores")).findFirst().orElseThrow().getState());
    }

    @Test
    void overviewCountsOnlyFieldsNeedingAttention() {
        MappingOverviewVO overview = service.overview("tenant-a");
        assertEquals(2, overview.getPendingCount(), "sn 是预置，两个自定义字段待处理");

        row("rack_note", SosFieldMapping.STATUS_UNMAPPABLE, SosTestSupport.attribute("rack_note", "singlechar"));
        assertEquals(1, service.overview("tenant-a").getPendingCount());
    }

    @Test
    void builtInFieldWithoutPresetIsManualOnlyAndNotPending() {
        CiAttribute operator = SosTestSupport.attribute("env_note", "singlechar");
        operator.setIsBuiltIn(true);
        when(attributeMapper.listByModel(SosPresetRules.MODEL_CODE, "tenant-a")).thenReturn(List.of(operator));

        MappingOverviewVO overview = service.overview("tenant-a");

        assertEquals(0, overview.getPendingCount());
        assertEquals("manual_only", overview.getFields().get(0).getState());
    }

    @Test
    void refusesToOverridePresets() {
        BusinessException exception = assertThrows(BusinessException.class,
            () -> service.save(admin, "sn", confirm("system.uuid", "direct")));
        assertEquals("SOS_MAPPING_PRESET", exception.getErrorCode());
        verify(mappingMapper, never()).insert(any(SosFieldMapping.class));
    }

    @Test
    void refusesIncompatibleRule() {
        BusinessException exception = assertThrows(BusinessException.class,
            () -> service.save(admin, "logical_cores", confirm("os.kernel", "direct")));
        assertEquals("SOS_MAPPING_INCOMPATIBLE", exception.getErrorCode());
    }

    @Test
    void refusesUnknownStatusAndField() {
        SaveMappingRequest suggested = confirm("cpu.threads", "direct");
        suggested.setStatus(SosFieldMapping.STATUS_SUGGESTED);
        assertThrows(BusinessException.class, () -> service.save(admin, "logical_cores", suggested), "接口不能直接写入 suggested");
        assertThrows(BusinessException.class, () -> service.save(admin, "no_such_field", confirm("cpu.threads", "direct")));
    }

    @Test
    void savesConfirmedRuleWithAuditAndFingerprint() {
        service.save(admin, "logical_cores", confirm("cpu.threads", "direct"));

        ArgumentCaptor<SosFieldMapping> saved = ArgumentCaptor.forClass(SosFieldMapping.class);
        verify(mappingMapper).insert(saved.capture());
        assertEquals("tenant-a", saved.getValue().getTenantId());
        assertEquals(SosFieldMapping.SOURCE_MANUAL, saved.getValue().getSource());
        assertEquals(SosMappingEngine.fingerprint(cores), saved.getValue().getFieldFingerprint());
        assertEquals(7L, saved.getValue().getConfirmedBy());
        ArgumentCaptor<AuditLog> audit = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogMapper).insert(audit.capture());
        assertEquals("mapping_confirm", audit.getValue().getAction());
    }

    @Test
    void confirmingAiSuggestionAsIsKeepsAiSource() {
        SosFieldMapping suggestion = row("logical_cores", SosFieldMapping.STATUS_SUGGESTED, cores);
        suggestion.setSource(SosFieldMapping.SOURCE_AI);

        service.save(admin, "logical_cores", confirm("cpu.threads", "direct"));

        assertEquals(SosFieldMapping.SOURCE_AI, suggestion.getSource());
        assertEquals(SosFieldMapping.STATUS_CONFIRMED, suggestion.getStatus());
        verify(mappingMapper).updateById(eq(suggestion));
    }

    @Test
    void changingAiSuggestionBeforeConfirmingCountsAsManual() {
        SosFieldMapping suggestion = row("logical_cores", SosFieldMapping.STATUS_SUGGESTED, cores);
        suggestion.setSource(SosFieldMapping.SOURCE_AI);

        service.save(admin, "logical_cores", confirm("cpu.cores", "direct"));

        assertEquals(SosFieldMapping.SOURCE_MANUAL, suggestion.getSource());
    }

    @Test
    void markingUnmappableClearsPreviousRule() {
        SosFieldMapping existing = row("logical_cores", SosFieldMapping.STATUS_CONFIRMED, cores);
        SaveMappingRequest request = new SaveMappingRequest();
        request.setStatus(SosFieldMapping.STATUS_UNMAPPABLE);

        service.save(admin, "logical_cores", request);

        assertNull(existing.getFactKey());
        assertNull(existing.getTransform());
        assertFalse(resolved().containsKey("logical_cores"));
    }

    @Test
    void removeSoftDeletesAndAudits() {
        SosFieldMapping existing = row("logical_cores", SosFieldMapping.STATUS_CONFIRMED, cores);

        service.remove(admin, "logical_cores");

        assertEquals(7L, existing.getDeletedBy());
        verify(mappingMapper).deleteById(1L);
        ArgumentCaptor<AuditLog> audit = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogMapper).insert(audit.capture());
        assertTrue(audit.getValue().getBeforeJson().contains("cpu.threads"));
    }

    @Test
    void catalogExposesOnlyStaticData() {
        assertFalse(service.catalog().getFacts().isEmpty());
        assertEquals(7, service.catalog().getTransforms().size());
    }
}
