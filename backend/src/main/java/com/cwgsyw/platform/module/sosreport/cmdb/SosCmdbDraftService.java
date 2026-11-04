package com.cwgsyw.platform.module.sosreport.cmdb;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.service.CiFieldSchemaValidator;
import com.cwgsyw.platform.module.cmdb.service.CiInstanceUniquenessValidator;
import com.cwgsyw.platform.module.sosreport.dto.SosCmdbDtos.CmdbDraftRequest;
import com.cwgsyw.platform.module.sosreport.dto.SosCmdbDtos.CmdbPreviewVO;
import com.cwgsyw.platform.module.sosreport.dto.SosCmdbDtos.PreviewFieldVO;
import com.cwgsyw.platform.module.sosreport.entity.SosCmdbRequest;
import com.cwgsyw.platform.module.sosreport.entity.SosFieldMapping;
import com.cwgsyw.platform.module.sosreport.entity.SosReport;
import com.cwgsyw.platform.module.sosreport.mapper.SosCmdbRequestMapper;
import com.cwgsyw.platform.module.sosreport.mapping.SosFieldMappingService;
import com.cwgsyw.platform.module.sosreport.mapping.SosMappingEngine;
import com.cwgsyw.platform.module.sosreport.mapping.SosPresetRules;
import com.cwgsyw.platform.module.sosreport.mapping.SosRule;
import com.cwgsyw.platform.module.sosreport.parser.SosFactCatalog;
import com.cwgsyw.platform.module.workflow.adapter.SosCmdbWorkflowAdapter;
import com.cwgsyw.platform.module.workflow.binding.ProcessBindingService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 把报告的事实和人工修改合成为一份 CMDB 草稿：字段值、匹配的 CI、能否提交。
 * 预览和提交都调用这里，服务端不信任前端算好的结果。
 */
@Service
@RequiredArgsConstructor
public class SosCmdbDraftService {

    public static final String ACTION_CONFLICT = "conflict";

    private final SosFieldMappingService mappingService;
    private final CiInstanceMapper instanceMapper;
    private final SosCmdbRequestMapper requestMapper;
    private final CiFieldSchemaValidator schemaValidator;
    private final CiInstanceUniquenessValidator uniquenessValidator;
    private final ProcessBindingService bindingService;

    public Draft build(SosReport report, CmdbDraftRequest input) {
        String tenantId = report.getTenantId();
        List<CiAttribute> attributes = mappingService.attributes(tenantId);
        Map<String, SosRule> rules = mappingService.resolve(tenantId, attributes);
        Map<String, SosFieldMapping> ruleRows = mappingService.rows(tenantId);
        Map<String, Object> overrides = input != null && input.getOverrides() != null ? input.getOverrides() : Map.of();
        Set<String> excluded = input != null && input.getExcludedFields() != null ? new HashSet<>(input.getExcludedFields()) : Set.of();

        CmdbPreviewVO preview = new CmdbPreviewVO();
        preview.setModelCode(SosPresetRules.MODEL_CODE);

        Set<String> known = attributes.stream().map(CiAttribute::getFieldKey).collect(Collectors.toSet());
        overrides.keySet().stream().filter(key -> !known.contains(key)).sorted()
            .forEach(key -> preview.getBlockingReasons().add("未知字段：" + key));

        Map<String, Object> values = new LinkedHashMap<>();
        for (CiAttribute attribute : attributes) {
            preview.getFields().add(buildField(attribute, report.getFacts(), rules, ruleRows, overrides, excluded, values));
        }

        Match match = match(tenantId, report, values);
        applyMatch(preview, match);
        preview.setInstanceName(resolveName(input, match.target(), values));
        compareWithTarget(preview, attributes, match.target());

        Map<String, Object> proposed = validate(preview, attributes, match.target(), values, tenantId);

        preview.setWorkflowConfigured(bindingService.getActiveBinding(tenantId, SosCmdbWorkflowAdapter.BUSINESS_TYPE) != null);
        if (!preview.isWorkflowConfigured()) {
            preview.getBlockingReasons().add("还没有为“SOS 报告入库”配置审批流程，请联系管理员");
        }
        if (hasPendingRequest(tenantId, report.getId())) {
            preview.getBlockingReasons().add("这份报告已有审批中的入库申请");
        }
        preview.setPendingMappingCount(mappingService.pendingCount(tenantId, attributes));
        if (preview.getPendingMappingCount() > 0) {
            preview.getWarnings().add("有 " + preview.getPendingMappingCount() + " 个自定义字段尚未配置映射规则，可在此手动填写或先配置规则");
        }
        preview.setCanSubmit(preview.getBlockingReasons().isEmpty());
        return new Draft(preview, proposed, fieldDetails(preview, proposed), match.target());
    }

    public record Draft(CmdbPreviewVO preview, Map<String, Object> proposedFields,
                        List<Map<String, Object>> fieldDetails, CiInstance target) {
    }

    /** 审批内容的快照。key 是 API 字段，值为空的项不写入。 */
    private static List<Map<String, Object>> fieldDetails(CmdbPreviewVO preview, Map<String, Object> proposed) {
        List<Map<String, Object>> details = new ArrayList<>();
        for (PreviewFieldVO field : preview.getFields()) {
            if (!proposed.containsKey(field.getFieldKey())) continue;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("fieldKey", field.getFieldKey());
            row.put("name", field.getName());
            row.put("value", field.getValue());
            putIfPresent(row, "currentValue", field.getCurrentValue());
            row.put("origin", field.getOrigin());
            putIfPresent(row, "factLabel", field.getFactLabel());
            putIfPresent(row, "ruleSource", field.getRuleSource());
            putIfPresent(row, "aiConfidence", field.getAiConfidence());
            putIfPresent(row, "aiReason", field.getAiReason());
            details.add(row);
        }
        return details;
    }

    private static void putIfPresent(Map<String, Object> row, String key, Object value) {
        if (value != null) row.put(key, value);
    }

    private record Match(CiInstance target, String conflict) {
    }

    private PreviewFieldVO buildField(CiAttribute attribute, Map<String, Object> facts, Map<String, SosRule> rules,
                                      Map<String, SosFieldMapping> ruleRows, Map<String, Object> overrides, Set<String> excluded, Map<String, Object> values) {
        String key = attribute.getFieldKey();
        PreviewFieldVO field = new PreviewFieldVO();
        field.setFieldKey(key);
        field.setName(attribute.getName());
        field.setGroupId(attribute.getGroupId());
        field.setFieldType(attribute.getFieldType());
        field.setRequired(Boolean.TRUE.equals(attribute.getIsRequired()));
        field.setEditable(Boolean.TRUE.equals(attribute.getIsEditable()));
        field.setUnique(Boolean.TRUE.equals(attribute.getIsUnique()));
        field.setOptions(SosFieldMappingService.options(attribute));
        field.setOrigin("none");

        SosRule rule = rules.get(key);
        if (rule != null) {
            field.setFactKey(rule.factKey());
            field.setTransform(rule.transform());
        }
        if (excluded.contains(key)) {
            field.setExcluded(true);
            return field;
        }
        if (isPresent(overrides.get(key))) {
            field.setOrigin("manual");
            field.setValue(overrides.get(key));
            values.put(key, overrides.get(key));
            return field;
        }
        if (rule != null) {
            field.setOrigin(SosPresetRules.isPreset(key) ? "preset" : "confirmed");
            SosFactCatalog.find(rule.factKey()).ifPresent(fact -> field.setFactLabel(fact.label()));
            markRuleSource(field, key, ruleRows);
            SosMappingEngine.Evaluation evaluation = SosMappingEngine.evaluate(rule, facts, attribute);
            field.setProblem(evaluation.problem());
            if (evaluation.value() != null) {
                field.setValue(evaluation.value());
                values.put(key, evaluation.value());
            }
        }
        return field;
    }

    /** 预置规则没有规则行。人工改过 AI 建议后来源是 manual，不再算 AI。 */
    private static void markRuleSource(PreviewFieldVO field, String key, Map<String, SosFieldMapping> ruleRows) {
        SosFieldMapping row = SosPresetRules.isPreset(key) ? null : ruleRows.get(key);
        if (row == null) return;
        field.setRuleSource(row.getSource());
        if (SosFieldMapping.SOURCE_AI.equals(row.getSource())) {
            field.setAiConfidence(row.getAiConfidence());
            field.setAiReason(row.getAiReason());
        }
    }

    /**
     * 依次按序列号、系统 UUID、内网 IP 找现有 CI。
     * 多个匹配指向不同实例，或只有 IP 相同而序列号不同，都不能自动判断，交给人工。
     */
    private Match match(String tenantId, SosReport report, Map<String, Object> values) {
        String sn = text(values.get(SosPresetRules.FIELD_SN));
        String ip = text(values.get(SosPresetRules.FIELD_INNER_IP));

        List<CiInstance> bySn = findByAttr(tenantId, SosPresetRules.FIELD_SN, sn);
        List<CiInstance> byIp = findByAttr(tenantId, SosPresetRules.FIELD_INNER_IP, ip);
        List<CiInstance> byUuid = findByUuid(tenantId, report.getSystemUuid());

        Map<Long, CiInstance> all = new LinkedHashMap<>();
        bySn.forEach(instance -> all.put(instance.getId(), instance));
        byUuid.forEach(instance -> all.put(instance.getId(), instance));
        byIp.forEach(instance -> all.put(instance.getId(), instance));

        if (all.isEmpty()) return new Match(null, null);
        if (all.size() > 1) {
            String names = all.values().stream().map(SosCmdbDraftService::label).collect(Collectors.joining("、"));
            return new Match(null, "序列号、UUID 和 IP 匹配到多个不同的实例：" + names + "，请先在 CMDB 中核实");
        }
        CiInstance only = all.values().iterator().next();
        if (bySn.isEmpty() && byUuid.isEmpty()) {
            String existingSn = only.getFieldsData() == null ? null : text(only.getFieldsData().get(SosPresetRules.FIELD_SN));
            if (existingSn != null && sn != null && !existingSn.equals(sn)) {
                return new Match(null, "IP " + ip + " 已被实例 " + label(only) + " 使用，但序列号不同，可能是 IP 复用或换机，请先在 CMDB 中核实");
            }
        }
        return new Match(only, null);
    }

    private void applyMatch(CmdbPreviewVO preview, Match match) {
        if (match.conflict() != null) {
            preview.setAction(ACTION_CONFLICT);
            preview.getBlockingReasons().add(match.conflict());
        } else if (match.target() != null) {
            preview.setAction(SosCmdbRequest.ACTION_UPDATE);
            preview.setTargetInstanceId(match.target().getId());
            preview.setTargetInstanceName(match.target().getName());
        } else {
            preview.setAction(SosCmdbRequest.ACTION_CREATE);
        }
    }

    private String resolveName(CmdbDraftRequest input, CiInstance target, Map<String, Object> values) {
        String requested = input == null ? null : text(input.getInstanceName());
        if (requested != null) return requested;
        if (target != null) return target.getName();
        String hostname = text(values.get(SosPresetRules.FIELD_HOSTNAME));
        return hostname != null ? hostname : text(values.get(SosPresetRules.FIELD_INNER_IP));
    }

    private void compareWithTarget(CmdbPreviewVO preview, List<CiAttribute> attributes, CiInstance target) {
        if (target == null) {
            preview.getFields().forEach(field -> field.setChanged(field.getValue() != null));
            return;
        }
        Map<String, Object> current = target.getFieldsData() == null ? Map.of() : target.getFieldsData();
        Map<String, CiAttribute> byKey = attributes.stream().collect(Collectors.toMap(CiAttribute::getFieldKey, attribute -> attribute));
        for (PreviewFieldVO field : preview.getFields()) {
            Object existing = current.get(field.getFieldKey());
            field.setCurrentValue(existing);
            if (field.getValue() == null || SosMappingEngine.sameValue(field.getValue(), existing)) continue;
            if (Boolean.TRUE.equals(byKey.get(field.getFieldKey()).getIsEditable())) {
                field.setChanged(true);
            } else if (existing != null) {
                field.setProblem("不可编辑的字段，更新时不会修改（现有值：" + existing + "）");
                preview.getWarnings().add("字段“" + field.getName() + "”与现有实例不同，但不可编辑，不会更新");
            } else {
                // 现有实例这个字段是空的，补写不算修改身份。
                field.setChanged(true);
            }
        }
    }

    private Map<String, Object> validate(CmdbPreviewVO preview, List<CiAttribute> attributes, CiInstance target,
                                         Map<String, Object> values, String tenantId) {
        if (preview.getInstanceName() == null) {
            preview.getBlockingReasons().add("实例名称不能为空");
        }
        Map<String, Object> proposed = new LinkedHashMap<>();
        preview.getFields().stream()
            .filter(field -> field.getValue() != null && (target == null || field.isChanged()))
            .forEach(field -> proposed.put(field.getFieldKey(), field.getValue()));

        if (SosCmdbDraftService.ACTION_CONFLICT.equals(preview.getAction())) return proposed;

        Map<String, Object> merged = new HashMap<>();
        if (target != null && target.getFieldsData() != null) merged.putAll(target.getFieldsData());
        merged.putAll(proposed);

        // CMDB 校验器放过空字符串，这里补上必填检查。
        Set<String> missing = new LinkedHashSet<>();
        for (CiAttribute attribute : attributes) {
            if (Boolean.TRUE.equals(attribute.getIsRequired()) && !isPresent(merged.get(attribute.getFieldKey()))) {
                missing.add(attribute.getName());
            }
        }
        if (!missing.isEmpty()) {
            preview.getBlockingReasons().add("必填字段缺失：" + String.join("、", missing) + "，请手动填写");
            return proposed;
        }

        addFailure(preview, () -> schemaValidator.validate(merged, attributes));
        addFailure(preview, () -> uniquenessValidator.validate(merged, attributes, tenantId, SosPresetRules.MODEL_CODE,
            target == null ? null : target.getId()));

        boolean nameChanged = target != null && !Objects.equals(preview.getInstanceName(), target.getName());
        if (target == null || nameChanged) {
            long sameName = instanceMapper.selectCount(new LambdaQueryWrapper<CiInstance>()
                .eq(CiInstance::getTenantId, tenantId)
                .eq(CiInstance::getModelId, SosPresetRules.MODEL_CODE)
                .eq(CiInstance::getName, preview.getInstanceName())
                .eq(CiInstance::getIsDeleted, false));
            if (sameName > 0) {
                preview.getBlockingReasons().add("实例名称“" + preview.getInstanceName() + "”已被其他实例使用，请修改");
            }
        }
        if (target != null && proposed.isEmpty() && !nameChanged) {
            preview.getBlockingReasons().add("与现有实例没有差异，无需提交");
        }
        return proposed;
    }

    private static void addFailure(CmdbPreviewVO preview, Runnable check) {
        try {
            check.run();
        } catch (IllegalArgumentException e) {
            preview.getBlockingReasons().add(e.getMessage());
        }
    }

    private boolean hasPendingRequest(String tenantId, Long reportId) {
        return requestMapper.selectCount(new LambdaQueryWrapper<SosCmdbRequest>()
            .eq(SosCmdbRequest::getTenantId, tenantId)
            .eq(SosCmdbRequest::getReportId, reportId)
            .eq(SosCmdbRequest::getStatus, SosCmdbRequest.STATUS_PENDING)) > 0;
    }

    private List<CiInstance> findByAttr(String tenantId, String fieldKey, String value) {
        if (value == null) return List.of();
        // fieldKey 是代码里的常量，不是外部输入；值走参数绑定。
        return instanceMapper.selectList(new LambdaQueryWrapper<CiInstance>()
            .eq(CiInstance::getTenantId, tenantId)
            .eq(CiInstance::getModelId, SosPresetRules.MODEL_CODE)
            .eq(CiInstance::getIsDeleted, false)
            .apply("attrs->>'" + fieldKey + "' = {0}", value));
    }

    private List<CiInstance> findByUuid(String tenantId, String systemUuid) {
        if (systemUuid == null || systemUuid.isBlank()) return List.of();
        List<Long> ids = requestMapper.findAppliedInstanceIdsByUuid(tenantId, SosPresetRules.MODEL_CODE, systemUuid);
        if (ids.isEmpty()) return List.of();
        return new ArrayList<>(instanceMapper.selectList(new LambdaQueryWrapper<CiInstance>()
            .eq(CiInstance::getTenantId, tenantId)
            .eq(CiInstance::getModelId, SosPresetRules.MODEL_CODE)
            .eq(CiInstance::getIsDeleted, false)
            .in(CiInstance::getId, ids)));
    }

    private static String label(CiInstance instance) {
        return instance.getName() + "（#" + instance.getId() + "）";
    }

    private static boolean isPresent(Object value) {
        return value != null && !(value instanceof String text && text.isBlank());
    }

    private static String text(Object value) {
        if (value == null) return null;
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }
}
