package com.cwgsyw.platform.module.sosreport.mapping;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.ai.AiGatewayService;
import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import com.cwgsyw.platform.module.cmdb.mapper.CiAttributeMapper;
import com.cwgsyw.platform.module.sosreport.dto.SosMappingDtos.FactCatalogVO;
import com.cwgsyw.platform.module.sosreport.dto.SosMappingDtos.FieldMappingVO;
import com.cwgsyw.platform.module.sosreport.dto.SosMappingDtos.MappingOverviewVO;
import com.cwgsyw.platform.module.sosreport.dto.SosMappingDtos.OptionVO;
import com.cwgsyw.platform.module.sosreport.dto.SosMappingDtos.SaveMappingRequest;
import com.cwgsyw.platform.module.sosreport.dto.SosMappingDtos.TransformVO;
import com.cwgsyw.platform.module.sosreport.entity.SosFieldMapping;
import com.cwgsyw.platform.module.sosreport.mapper.SosFieldMappingMapper;
import com.cwgsyw.platform.module.sosreport.parser.SosFactCatalog;
import com.cwgsyw.platform.security.SecurityUser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 字段映射规则的查询和维护。
 *
 * <p>字段是否生效的判定集中在 {@link #resolve}：预置规则优先；其次是指纹仍然匹配的已确认规则；
 * AI 建议（suggested）永远不生效。
 */
@Service
@RequiredArgsConstructor
public class SosFieldMappingService {

    private final SosFieldMappingMapper mappingMapper;
    private final CiAttributeMapper attributeMapper;
    private final AuditLogMapper auditLogMapper;
    private final AiGatewayService aiGatewayService;
    private final ObjectMapper objectMapper;

    public MappingOverviewVO overview(String tenantId) {
        List<CiAttribute> attributes = attributes(tenantId);
        Map<String, SosFieldMapping> rows = rows(tenantId);
        List<FieldMappingVO> fields = attributes.stream().map(attribute -> toVO(attribute, rows.get(attribute.getFieldKey()))).toList();

        MappingOverviewVO overview = new MappingOverviewVO();
        overview.setModelCode(SosPresetRules.MODEL_CODE);
        overview.setFields(fields);
        overview.setPendingCount((int) fields.stream().filter(SosFieldMappingService::needsAttention).count());
        overview.setAiAvailable(aiGatewayService.isAvailable(tenantId));
        return overview;
    }

    public FactCatalogVO catalog() {
        FactCatalogVO catalog = new FactCatalogVO();
        catalog.setFacts(SosFactCatalog.all());
        catalog.setTransforms(List.of(
            new TransformVO(SosTransform.DIRECT.code(), "直接取值"),
            new TransformVO(SosTransform.COUNT.code(), "列表计数"),
            new TransformVO(SosTransform.JOIN.code(), "列表拼接（逗号分隔）"),
            new TransformVO(SosTransform.ROUND.code(), "四舍五入取整"),
            new TransformVO(SosTransform.GB_TO_MB.code(), "GB 转 MB"),
            new TransformVO(SosTransform.GB_TO_TB.code(), "GB 转 TB"),
            new TransformVO(SosTransform.ENUM_MAP.code(), "枚举映射")));
        return catalog;
    }

    /** 当前对每个字段生效的规则。不在结果里的字段没有可用规则。 */
    public Map<String, SosRule> resolve(String tenantId, List<CiAttribute> attributes) {
        Map<String, SosFieldMapping> rows = rows(tenantId);
        Map<String, SosRule> rules = new LinkedHashMap<>();
        for (CiAttribute attribute : attributes) {
            String key = attribute.getFieldKey();
            if (SosPresetRules.isPreset(key)) {
                SosPresetRules.find(key).ifPresent(rule -> rules.put(key, rule));
                continue;
            }
            SosFieldMapping row = rows.get(key);
            if (isEffective(row, attribute)) {
                rules.put(key, new SosRule(key, row.getFactKey(), row.getTransform(), row.getTransformArgs(), null));
            }
        }
        return rules;
    }

    /** 待处理的自定义字段数。内置字段没有规则时默认人工填写，不计入。 */
    public int pendingCount(String tenantId, List<CiAttribute> attributes) {
        Map<String, SosFieldMapping> rows = rows(tenantId);
        return (int) attributes.stream().map(attribute -> toVO(attribute, rows.get(attribute.getFieldKey())))
            .filter(SosFieldMappingService::needsAttention).count();
    }

    @Transactional
    public FieldMappingVO save(SecurityUser user, String fieldKey, SaveMappingRequest request) {
        String tenantId = user.getTenantId();
        CiAttribute attribute = requireAttribute(tenantId, fieldKey);
        if (SosPresetRules.isPreset(fieldKey)) {
            throw BusinessException.badRequest("SOS_MAPPING_PRESET", "内置字段使用预置规则，不能修改");
        }

        String status = request.getStatus();
        boolean confirm = SosFieldMapping.STATUS_CONFIRMED.equals(status);
        if (!confirm && !SosFieldMapping.STATUS_UNMAPPABLE.equals(status)) {
            throw BusinessException.badRequest("SOS_MAPPING_STATUS", "状态只能是 confirmed 或 unmappable");
        }
        if (confirm) {
            String problem = SosMappingEngine.incompatibility(
                request.getFactKey(), request.getTransform(), request.getTransformArgs(), attribute);
            if (problem != null) throw BusinessException.badRequest("SOS_MAPPING_INCOMPATIBLE", problem);
        }

        SosFieldMapping existing = rows(tenantId).get(fieldKey);
        String before = existing == null ? null : snapshot(existing);
        SosFieldMapping row = existing != null ? existing : new SosFieldMapping();
        // 确认的内容和 AI 建议完全一致时保留来源，便于追溯。
        boolean sameAsSuggestion = existing != null
            && SosFieldMapping.SOURCE_AI.equals(existing.getSource())
            && SosFieldMapping.STATUS_SUGGESTED.equals(existing.getStatus())
            && (confirm
                ? Objects.equals(existing.getFactKey(), request.getFactKey())
                    && Objects.equals(existing.getTransform(), request.getTransform())
                : "unmappable".equals(existing.getAiVerdict()));
        row.setTenantId(tenantId);
        row.setModelCode(SosPresetRules.MODEL_CODE);
        row.setFieldKey(fieldKey);
        row.setStatus(status);
        row.setSource(sameAsSuggestion ? SosFieldMapping.SOURCE_AI : SosFieldMapping.SOURCE_MANUAL);
        row.setFactKey(confirm ? request.getFactKey() : null);
        row.setTransform(confirm ? request.getTransform() : null);
        row.setTransformArgs(confirm && request.getTransformArgs() != null ? request.getTransformArgs() : Map.of());
        row.setFieldFingerprint(SosMappingEngine.fingerprint(attribute));
        row.setConfirmedBy(user.getUserId());
        row.setConfirmedAt(LocalDateTime.now());

        try {
            if (existing == null) mappingMapper.insert(row);
            else mappingMapper.updateById(row);
        } catch (DuplicateKeyException e) {
            throw new BusinessException(HttpStatus.CONFLICT, "SOS_MAPPING_CONFLICT", "该字段的规则刚被修改，请刷新后重试");
        }
        writeAudit(tenantId, "mapping_confirm", row.getId(), user.getUserId(), before, snapshot(row), fieldKey);
        return toVO(attribute, row);
    }

    @Transactional
    public void remove(SecurityUser user, String fieldKey) {
        String tenantId = user.getTenantId();
        SosFieldMapping row = rows(tenantId).get(fieldKey);
        if (row == null) return;
        String before = snapshot(row);
        row.setDeletedAt(LocalDateTime.now());
        row.setDeletedBy(user.getUserId());
        mappingMapper.updateById(row);
        mappingMapper.deleteById(row.getId());
        writeAudit(tenantId, "mapping_remove", row.getId(), user.getUserId(), before, null, fieldKey);
    }

    public List<CiAttribute> attributes(String tenantId) {
        return attributeMapper.listByModel(SosPresetRules.MODEL_CODE, tenantId);
    }

    public Map<String, SosFieldMapping> rows(String tenantId) {
        return mappingMapper.selectList(new LambdaQueryWrapper<SosFieldMapping>()
                .eq(SosFieldMapping::getTenantId, tenantId)
                .eq(SosFieldMapping::getModelCode, SosPresetRules.MODEL_CODE))
            .stream().collect(Collectors.toMap(SosFieldMapping::getFieldKey, Function.identity(), (a, b) -> a));
    }

    private CiAttribute requireAttribute(String tenantId, String fieldKey) {
        return attributes(tenantId).stream().filter(attribute -> attribute.getFieldKey().equals(fieldKey)).findFirst()
            .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "SOS_MAPPING_FIELD_NOT_FOUND", "字段不存在"));
    }

    private static boolean isEffective(SosFieldMapping row, CiAttribute attribute) {
        return row != null
            && SosFieldMapping.STATUS_CONFIRMED.equals(row.getStatus())
            && Objects.equals(row.getFieldFingerprint(), SosMappingEngine.fingerprint(attribute));
    }

    private static boolean needsAttention(FieldMappingVO field) {
        return List.of("pending", "stale", "suggested").contains(field.getState());
    }

    static FieldMappingVO toVO(CiAttribute attribute, SosFieldMapping row) {
        String key = attribute.getFieldKey();
        FieldMappingVO vo = new FieldMappingVO();
        vo.setFieldKey(key);
        vo.setName(attribute.getName());
        vo.setGroupId(attribute.getGroupId());
        vo.setFieldType(attribute.getFieldType());
        vo.setRequired(Boolean.TRUE.equals(attribute.getIsRequired()));
        vo.setUnique(Boolean.TRUE.equals(attribute.getIsUnique()));
        vo.setBuiltIn(Boolean.TRUE.equals(attribute.getIsBuiltIn()));
        vo.setSupported(SosMappingEngine.isSupported(attribute));
        vo.setOptions(options(attribute));

        SosRule preset = SosPresetRules.find(key).orElse(null);
        if (preset != null) {
            vo.setState("preset");
            vo.setFactKey(preset.factKey());
            vo.setTransform(preset.transform());
            vo.setTransformArgs(preset.args());
            SosFactCatalog.find(preset.factKey()).ifPresent(fact -> vo.setFactLabel(fact.label()));
            return vo;
        }
        if (row != null) {
            vo.setSource(row.getSource());
            vo.setFactKey(row.getFactKey());
            vo.setTransform(row.getTransform());
            vo.setTransformArgs(row.getTransformArgs());
            vo.setAiVerdict(row.getAiVerdict());
            vo.setAiConfidence(row.getAiConfidence());
            vo.setAiReason(row.getAiReason());
            SosFactCatalog.find(row.getFactKey()).ifPresent(fact -> vo.setFactLabel(fact.label()));
        }
        vo.setState(state(attribute, row));
        return vo;
    }

    private static String state(CiAttribute attribute, SosFieldMapping row) {
        boolean builtIn = Boolean.TRUE.equals(attribute.getIsBuiltIn());
        if (row != null) {
            if (SosFieldMapping.STATUS_UNMAPPABLE.equals(row.getStatus())) return "unmappable";
            if (SosFieldMapping.STATUS_SUGGESTED.equals(row.getStatus())) return "suggested";
            if (isEffective(row, attribute)) return "confirmed";
            return "stale";
        }
        if (!SosMappingEngine.isSupported(attribute)) return "manual_only";
        return builtIn ? "manual_only" : "pending";
    }

    public static List<OptionVO> options(CiAttribute attribute) {
        List<OptionVO> options = new ArrayList<>();
        if (attribute.getOption() instanceof List<?> list) {
            for (Object option : list) {
                if (option instanceof Map<?, ?> row && row.get("id") != null) {
                    Object name = row.get("name");
                    options.add(new OptionVO(String.valueOf(row.get("id")), name == null ? String.valueOf(row.get("id")) : String.valueOf(name)));
                }
            }
        }
        return options;
    }

    private String snapshot(SosFieldMapping row) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("fieldKey", row.getFieldKey());
        snapshot.put("status", row.getStatus());
        snapshot.put("factKey", row.getFactKey());
        snapshot.put("transform", row.getTransform());
        snapshot.put("transformArgs", row.getTransformArgs());
        snapshot.put("source", row.getSource());
        try {
            return objectMapper.writeValueAsString(snapshot);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    private void writeAudit(String tenantId, String action, Long id, Long operatorId, String before, String after, String fieldKey) {
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(tenantId).module("sos_report").action(action)
            .targetId(id).targetType("sos_field_mapping")
            .operatorId(operatorId).beforeJson(before).afterJson(after)
            .remark("field=" + fieldKey)
            .createdAt(LocalDateTime.now()).build());
    }
}
