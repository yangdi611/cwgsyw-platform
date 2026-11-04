package com.cwgsyw.platform.module.sosreport.cmdb;

import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.service.CiFieldSchemaValidator;
import com.cwgsyw.platform.module.cmdb.service.CiInstanceUniquenessValidator;
import com.cwgsyw.platform.module.sosreport.SosTestSupport;
import com.cwgsyw.platform.module.sosreport.dto.SosCmdbDtos.CmdbDraftRequest;
import com.cwgsyw.platform.module.sosreport.dto.SosCmdbDtos.CmdbPreviewVO;
import com.cwgsyw.platform.module.sosreport.dto.SosCmdbDtos.PreviewFieldVO;
import com.cwgsyw.platform.module.sosreport.entity.SosCmdbRequest;
import com.cwgsyw.platform.module.sosreport.entity.SosFieldMapping;
import com.cwgsyw.platform.module.sosreport.entity.SosReport;
import com.cwgsyw.platform.module.sosreport.mapper.SosCmdbRequestMapper;
import com.cwgsyw.platform.module.sosreport.mapping.SosFieldMappingService;
import com.cwgsyw.platform.module.sosreport.mapping.SosPresetRules;
import com.cwgsyw.platform.module.sosreport.mapping.SosRule;
import com.cwgsyw.platform.module.workflow.binding.ProcessBindingService;
import com.cwgsyw.platform.module.workflow.binding.WorkflowProcessBinding;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SosCmdbDraftServiceTest {

    @Mock SosFieldMappingService mappingService;
    @Mock CiInstanceMapper instanceMapper;
    @Mock SosCmdbRequestMapper requestMapper;
    @Mock CiInstanceUniquenessValidator uniquenessValidator;
    @Mock ProcessBindingService bindingService;

    private SosCmdbDraftService service;
    private final List<CiInstance> instancesFound = new ArrayList<>();
    private List<CiAttribute> attributes;
    private SosReport report;

    @BeforeEach
    void setUp() {
        SosTestSupport.initTables();
        service = new SosCmdbDraftService(mappingService, instanceMapper, requestMapper,
            new CiFieldSchemaValidator(new ObjectMapper()), uniquenessValidator, bindingService);
        CiAttribute hostname = SosTestSupport.attribute("hostname", "singlechar");
        CiAttribute cores = SosTestSupport.attribute("cpu_cores", "int");
        CiAttribute note = SosTestSupport.attribute("rack_note", "singlechar");
        attributes = List.of(SosTestSupport.identity("sn"), SosTestSupport.identity("inner_ip"), hostname, cores, note);
        when(mappingService.attributes("tenant-a")).thenReturn(attributes);

        Map<String, SosRule> rules = new LinkedHashMap<>();
        for (String key : List.of("sn", "inner_ip", "hostname", "cpu_cores")) {
            rules.put(key, SosPresetRules.find(key).orElseThrow());
        }
        when(mappingService.resolve(eq("tenant-a"), any())).thenReturn(rules);
        when(bindingService.getActiveBinding("tenant-a", "sos_cmdb_request")).thenReturn(new WorkflowProcessBinding());
        when(instanceMapper.selectList(any())).thenAnswer(invocation -> new ArrayList<>(instancesFound));
        when(instanceMapper.selectCount(any())).thenReturn(0L);
        when(requestMapper.selectCount(any())).thenReturn(0L);
        when(requestMapper.findAppliedInstanceIdsByUuid(anyString(), anyString(), anyString())).thenReturn(List.of());

        report = new SosReport();
        report.setId(5L);
        report.setTenantId("tenant-a");
        Map<String, Object> facts = new LinkedHashMap<>();
        facts.put("system.serialNumber", "SN-1");
        facts.put("network.primaryIp", "10.0.0.1");
        facts.put("system.hostname", "web-01");
        facts.put("cpu.cores", 64);
        report.setFacts(facts);
    }

    private CiInstance existing(long id, String name, String sn, String ip) {
        CiInstance instance = new CiInstance();
        instance.setId(id);
        instance.setName(name);
        instance.setTenantId("tenant-a");
        Map<String, Object> fields = new LinkedHashMap<>();
        if (sn != null) fields.put("sn", sn);
        if (ip != null) fields.put("inner_ip", ip);
        fields.put("hostname", name);
        fields.put("cpu_cores", 32);
        instance.setFieldsData(fields);
        return instance;
    }

    private static PreviewFieldVO field(CmdbPreviewVO preview, String key) {
        return preview.getFields().stream().filter(row -> row.getFieldKey().equals(key)).findFirst().orElseThrow();
    }

    @Test
    void newHostBecomesCreateRequest() {
        SosCmdbDraftService.Draft draft = service.build(report, null);
        CmdbPreviewVO preview = draft.preview();

        assertEquals(SosCmdbRequest.ACTION_CREATE, preview.getAction());
        assertEquals("web-01", preview.getInstanceName());
        assertTrue(preview.isCanSubmit(), String.valueOf(preview.getBlockingReasons()));
        assertEquals("SN-1", draft.proposedFields().get("sn"));
        assertEquals(64L, draft.proposedFields().get("cpu_cores"));
        assertEquals("preset", field(preview, "sn").getOrigin());
        assertEquals("none", field(preview, "rack_note").getOrigin());
    }

    private void customRule(String source) {
        SosFieldMapping row = new SosFieldMapping();
        row.setFieldKey("rack_note");
        row.setStatus(SosFieldMapping.STATUS_CONFIRMED);
        row.setSource(source);
        row.setFactKey("system.hostname");
        row.setAiConfidence(new java.math.BigDecimal("0.900"));
        row.setAiReason("字段名接近");
        when(mappingService.rows("tenant-a")).thenReturn(Map.of("rack_note", row));
        Map<String, SosRule> rules = new LinkedHashMap<>();
        for (String key : List.of("sn", "inner_ip", "hostname")) {
            rules.put(key, SosPresetRules.find(key).orElseThrow());
        }
        rules.put("rack_note", SosRule.of("rack_note", "system.hostname"));
        when(mappingService.resolve(eq("tenant-a"), any())).thenReturn(rules);
    }

    private static Map<String, Object> detail(SosCmdbDraftService.Draft draft, String key) {
        return draft.fieldDetails().stream().filter(row -> key.equals(row.get("fieldKey"))).findFirst().orElseThrow();
    }

    @Test
    void marksFieldsWhoseRuleCameFromAi() {
        customRule(SosFieldMapping.SOURCE_AI);

        SosCmdbDraftService.Draft draft = service.build(report, null);

        PreviewFieldVO field = field(draft.preview(), "rack_note");
        assertEquals("confirmed", field.getOrigin());
        assertEquals(SosFieldMapping.SOURCE_AI, field.getRuleSource());
        assertEquals("字段名接近", field.getAiReason());

        Map<String, Object> snapshot = detail(draft, "rack_note");
        assertEquals(SosFieldMapping.SOURCE_AI, snapshot.get("ruleSource"));
        assertEquals(new java.math.BigDecimal("0.900"), snapshot.get("aiConfidence"));
        assertEquals("字段名接近", snapshot.get("aiReason"));
        assertEquals("web-01", snapshot.get("value"));
        assertEquals("主机名", snapshot.get("factLabel"));
    }

    @Test
    void manualRuleCarriesNoAiDetails() {
        customRule(SosFieldMapping.SOURCE_MANUAL);

        Map<String, Object> snapshot = detail(service.build(report, null), "rack_note");

        assertEquals(SosFieldMapping.SOURCE_MANUAL, snapshot.get("ruleSource"));
        assertFalse(snapshot.containsKey("aiConfidence"), "规则被人工改过后不能再显示 AI 的判断");
        assertFalse(snapshot.containsKey("aiReason"));
    }

    @Test
    void handFilledValueOverridesAiAttribution() {
        customRule(SosFieldMapping.SOURCE_AI);
        CmdbDraftRequest input = new CmdbDraftRequest();
        input.setOverrides(Map.of("rack_note", "人工值"));

        Map<String, Object> snapshot = detail(service.build(report, input), "rack_note");

        assertEquals("manual", snapshot.get("origin"));
        assertFalse(snapshot.containsKey("ruleSource"), "人工填写的值不是 AI 给的");
    }

    @Test
    void presetFieldsAreNeverAttributedToAi() {
        customRule(SosFieldMapping.SOURCE_AI);

        Map<String, Object> snapshot = detail(service.build(report, null), "sn");

        assertEquals("preset", snapshot.get("origin"));
        assertFalse(snapshot.containsKey("ruleSource"));
    }

    @Test
    void snapshotIncludesOldValueOnUpdateAndOnlyChangedFields() {
        instancesFound.add(existing(100L, "web-01", "SN-1", "10.0.0.1"));

        SosCmdbDraftService.Draft draft = service.build(report, null);

        assertEquals(1, draft.fieldDetails().size());
        assertEquals(32, detail(draft, "cpu_cores").get("currentValue"));
        assertEquals(64L, detail(draft, "cpu_cores").get("value"));
    }

    @Test
    void missingSerialBlocksUntilFilledByHand() {
        report.getFacts().remove("system.serialNumber");

        CmdbPreviewVO blocked = service.build(report, null).preview();
        assertFalse(blocked.isCanSubmit());
        assertTrue(blocked.getBlockingReasons().stream().anyMatch(reason -> reason.contains("必填字段缺失") && reason.contains("sn")));

        CmdbDraftRequest input = new CmdbDraftRequest();
        input.setOverrides(Map.of("sn", "HAND-1"));
        SosCmdbDraftService.Draft filled = service.build(report, input);
        assertTrue(filled.preview().isCanSubmit(), String.valueOf(filled.preview().getBlockingReasons()));
        assertEquals("HAND-1", filled.proposedFields().get("sn"));
        assertEquals("manual", field(filled.preview(), "sn").getOrigin());
    }

    @Test
    void blankOverrideDoesNotSatisfyRequiredField() {
        report.getFacts().remove("system.serialNumber");
        CmdbDraftRequest input = new CmdbDraftRequest();
        input.setOverrides(Map.of("sn", "   "));

        assertFalse(service.build(report, input).preview().isCanSubmit(), "CMDB 校验器放过空字符串，这里必须拦住");
    }

    @Test
    void unknownOverrideIsRejected() {
        CmdbDraftRequest input = new CmdbDraftRequest();
        input.setOverrides(Map.of("_injected", "x", "not_a_field", "y"));

        CmdbPreviewVO preview = service.build(report, input).preview();

        assertFalse(preview.isCanSubmit());
        assertTrue(preview.getBlockingReasons().stream().anyMatch(reason -> reason.contains("not_a_field")));
    }

    @Test
    void invalidOverrideTypeIsReportedNotThrown() {
        CmdbDraftRequest input = new CmdbDraftRequest();
        input.setOverrides(Map.of("cpu_cores", "many"));

        CmdbPreviewVO preview = service.build(report, input).preview();

        assertFalse(preview.isCanSubmit());
        assertTrue(preview.getBlockingReasons().stream().anyMatch(reason -> reason.contains("整数")));
    }

    @Test
    void sameIdentityBecomesUpdateWithOnlyChangedFields() {
        instancesFound.add(existing(100L, "web-01", "SN-1", "10.0.0.1"));

        SosCmdbDraftService.Draft draft = service.build(report, null);

        assertEquals(SosCmdbRequest.ACTION_UPDATE, draft.preview().getAction());
        assertEquals(100L, draft.preview().getTargetInstanceId());
        assertEquals(Map.of("cpu_cores", 64L), draft.proposedFields());
        assertTrue(field(draft.preview(), "cpu_cores").isChanged());
        assertEquals(32, field(draft.preview(), "cpu_cores").getCurrentValue());
        assertFalse(field(draft.preview(), "sn").isChanged());
        assertTrue(draft.preview().isCanSubmit());
    }

    @Test
    void updateNeverChangesNonEditableFields() {
        report.getFacts().put("network.primaryIp", "10.0.0.99");
        instancesFound.add(existing(100L, "web-01", "SN-1", "10.0.0.1"));

        SosCmdbDraftService.Draft draft = service.build(report, null);

        assertFalse(draft.proposedFields().containsKey("inner_ip"));
        assertTrue(field(draft.preview(), "inner_ip").getProblem().contains("不可编辑"));
        assertTrue(draft.preview().getWarnings().stream().anyMatch(warning -> warning.contains("inner_ip")));
    }

    @Test
    void updateFillsEmptyNonEditableField() {
        instancesFound.add(existing(100L, "web-01", "SN-1", null));

        SosCmdbDraftService.Draft draft = service.build(report, null);

        assertEquals("10.0.0.1", draft.proposedFields().get("inner_ip"));
    }

    @Test
    void noDifferenceBlocksSubmit() {
        report.getFacts().put("cpu.cores", 32);
        instancesFound.add(existing(100L, "web-01", "SN-1", "10.0.0.1"));

        CmdbPreviewVO preview = service.build(report, null).preview();

        assertFalse(preview.isCanSubmit());
        assertTrue(preview.getBlockingReasons().stream().anyMatch(reason -> reason.contains("没有差异")));
    }

    @Test
    void excludedFieldIsNotProposed() {
        instancesFound.add(existing(100L, "web-01", "SN-1", "10.0.0.1"));
        CmdbDraftRequest input = new CmdbDraftRequest();
        input.setExcludedFields(List.of("cpu_cores"));

        SosCmdbDraftService.Draft draft = service.build(report, input);

        assertTrue(field(draft.preview(), "cpu_cores").isExcluded());
        assertTrue(draft.proposedFields().isEmpty());
    }

    @Test
    void multipleDifferentInstancesAreAConflict() {
        when(instanceMapper.selectList(any()))
            .thenReturn(new ArrayList<>(List.of(existing(100L, "a", "SN-1", "10.0.0.8"))))
            .thenReturn(new ArrayList<>(List.of(existing(200L, "b", "OTHER", "10.0.0.1"))));

        CmdbPreviewVO preview = service.build(report, null).preview();

        assertEquals(SosCmdbDraftService.ACTION_CONFLICT, preview.getAction());
        assertFalse(preview.isCanSubmit());
        assertTrue(preview.getBlockingReasons().get(0).contains("多个"));
        assertNull(preview.getTargetInstanceId());
    }

    @Test
    void sameIpWithDifferentSerialIsAConflict() {
        when(instanceMapper.selectList(any()))
            .thenReturn(new ArrayList<>())
            .thenReturn(new ArrayList<>(List.of(existing(200L, "b", "OTHER", "10.0.0.1"))));

        CmdbPreviewVO preview = service.build(report, null).preview();

        assertEquals(SosCmdbDraftService.ACTION_CONFLICT, preview.getAction());
        assertTrue(preview.getBlockingReasons().get(0).contains("序列号不同"));
    }

    @Test
    void sameIpOnInstanceWithoutSerialIsAnUpdate() {
        when(instanceMapper.selectList(any()))
            .thenReturn(new ArrayList<>())
            .thenReturn(new ArrayList<>(List.of(existing(200L, "b", null, "10.0.0.1"))));

        CmdbPreviewVO preview = service.build(report, null).preview();

        assertEquals(SosCmdbRequest.ACTION_UPDATE, preview.getAction());
        assertEquals(200L, preview.getTargetInstanceId());
    }

    @Test
    void matchesThroughSystemUuidHistory() {
        report.setSystemUuid("uuid-1");
        report.getFacts().remove("system.serialNumber");
        when(requestMapper.findAppliedInstanceIdsByUuid("tenant-a", "host", "uuid-1")).thenReturn(List.of(300L));
        when(instanceMapper.selectList(any()))
            .thenReturn(new ArrayList<>())
            .thenReturn(new ArrayList<>(List.of(existing(300L, "c", "SN-OLD", "10.0.0.5"))));

        CmdbPreviewVO preview = service.build(report, null).preview();

        assertEquals(SosCmdbRequest.ACTION_UPDATE, preview.getAction());
        assertEquals(300L, preview.getTargetInstanceId());
    }

    @Test
    void duplicateNameBlocksCreate() {
        when(instanceMapper.selectCount(any())).thenReturn(1L);

        CmdbPreviewVO preview = service.build(report, null).preview();

        assertFalse(preview.isCanSubmit());
        assertTrue(preview.getBlockingReasons().stream().anyMatch(reason -> reason.contains("已被其他实例使用")));
    }

    @Test
    void explicitInstanceNameWins() {
        CmdbDraftRequest input = new CmdbDraftRequest();
        input.setInstanceName("  renamed  ");

        assertEquals("renamed", service.build(report, input).preview().getInstanceName());
    }

    @Test
    void missingWorkflowBindingBlocksSubmit() {
        when(bindingService.getActiveBinding("tenant-a", "sos_cmdb_request")).thenReturn(null);

        CmdbPreviewVO preview = service.build(report, null).preview();

        assertFalse(preview.isWorkflowConfigured());
        assertFalse(preview.isCanSubmit());
        assertTrue(preview.getBlockingReasons().stream().anyMatch(reason -> reason.contains("审批流程")));
    }

    @Test
    void pendingRequestBlocksSubmit() {
        when(requestMapper.selectCount(any())).thenReturn(1L);

        assertFalse(service.build(report, null).preview().isCanSubmit());
    }
}
