package com.cwgsyw.platform.module.cmdb;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.dto.*;
import com.cwgsyw.platform.module.cmdb.entity.*;
import com.cwgsyw.platform.module.user.UserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CiInstanceService {

    private final CiInstanceMapper instanceMapper;
    private final CiAttributeMapper attributeMapper;
    private final CiModelMapper modelMapper;
    private final AuditLogMapper auditLogMapper;
    private final UserMapper userMapper;

    public PageResult<CiInstanceVO> listInstances(String tenantId, String modelId, int page, int size) {
        Page<CiInstance> result = instanceMapper.findByModel(new Page<>(page, size), tenantId, modelId);
        Set<Long> userIds = result.getRecords().stream()
                .filter(i -> i.getCreatedBy() != null)
                .map(CiInstance::getCreatedBy)
                .collect(Collectors.toSet());
        Map<Long, String> userNames = userIds.isEmpty() ? Map.of() :
                userMapper.selectBatchIds(userIds).stream()
                        .collect(Collectors.toMap(
                                com.cwgsyw.platform.module.user.entity.User::getId,
                                u -> u.getRealName() != null ? u.getRealName() : u.getUsername()));

        return PageResult.of(result.convert(inst -> toVO(inst, userNames, null)));
    }

    public CiInstanceVO getInstance(String tenantId, Long id) {
        CiInstance inst = findOrThrow(tenantId, id);
        List<CiAttributeVO> fieldConfig = attributeMapper.findByModel(tenantId, inst.getModelId())
                .stream().map(this::toAttrVO).collect(Collectors.toList());
        Map<Long, String> userNames = Map.of();
        if (inst.getCreatedBy() != null) {
            userNames = userMapper.selectBatchIds(List.of(inst.getCreatedBy())).stream()
                    .collect(Collectors.toMap(
                            com.cwgsyw.platform.module.user.entity.User::getId,
                            u -> u.getRealName() != null ? u.getRealName() : u.getUsername()));
        }
        return toVO(inst, userNames, fieldConfig);
    }

    @Transactional
    public CiInstanceVO createInstance(String tenantId, Long operatorId, String modelId,
                                        SaveCiInstanceRequest req) {
        CiModel model = modelMapper.selectOne(new LambdaQueryWrapper<CiModel>()
                .eq(CiModel::getTenantId, tenantId)
                .eq(CiModel::getModelId, modelId)
                .eq(CiModel::getIsDeleted, false));
        if (model == null) throw new IllegalArgumentException("CI模型不存在: " + modelId);

        List<CiAttribute> attrs = attributeMapper.findByModel(tenantId, modelId);
        validateAttrs(tenantId, modelId, req.getAttrs(), attrs, -1L);

        CiInstance inst = new CiInstance();
        inst.setTenantId(tenantId);
        inst.setModelId(modelId);
        inst.setAttrs(req.getAttrs() != null ? req.getAttrs() : new HashMap<>());
        inst.setName(deriveDisplayName(inst.getAttrs(), attrs));
        inst.setCreatedAt(LocalDateTime.now());
        inst.setUpdatedAt(LocalDateTime.now());
        inst.setCreatedBy(operatorId);
        inst.setUpdatedBy(operatorId);
        instanceMapper.insert(inst);

        writeAudit(tenantId, "create_instance", inst.getId(), operatorId,
                "model_id=" + modelId + " name=" + inst.getName());
        return toVO(inst, Map.of(), null);
    }

    @Transactional
    public CiInstanceVO updateInstance(String tenantId, Long id, Long operatorId,
                                        SaveCiInstanceRequest req) {
        CiInstance inst = findOrThrow(tenantId, id);
        List<CiAttribute> attrDefs = attributeMapper.findByModel(tenantId, inst.getModelId());

        Map<String, Object> merged = new HashMap<>(inst.getAttrs() != null ? inst.getAttrs() : Map.of());
        if (req.getAttrs() != null) merged.putAll(req.getAttrs());

        validateAttrs(tenantId, inst.getModelId(), merged, attrDefs, id);

        instanceMapper.update(null, new LambdaUpdateWrapper<CiInstance>()
                .eq(CiInstance::getId, id)
                .set(CiInstance::getAttrs, merged)
                .set(CiInstance::getName, deriveDisplayName(merged, attrDefs))
                .set(CiInstance::getUpdatedAt, LocalDateTime.now())
                .set(CiInstance::getUpdatedBy, operatorId));

        inst.setAttrs(merged);
        inst.setName(deriveDisplayName(merged, attrDefs));
        writeAudit(tenantId, "update_instance", id, operatorId, "id=" + id);
        return toVO(inst, Map.of(), null);
    }

    @Transactional
    public void deleteInstance(String tenantId, Long id, Long operatorId) {
        CiInstance inst = findOrThrow(tenantId, id);
        instanceMapper.update(null, new LambdaUpdateWrapper<CiInstance>()
                .eq(CiInstance::getId, id)
                .set(CiInstance::getIsDeleted, true)
                .set(CiInstance::getDeletedAt, LocalDateTime.now())
                .set(CiInstance::getDeletedBy, operatorId));
        writeAudit(tenantId, "delete_instance", id, operatorId,
                "model_id=" + inst.getModelId() + " name=" + inst.getName());
    }

    // ── Validation ────────────────────────────────────────────────────────────

    private void validateAttrs(String tenantId, String modelId, Map<String, Object> incoming,
                                List<CiAttribute> attrDefs, long excludeId) {
        if (incoming == null) incoming = Map.of();
        for (CiAttribute def : attrDefs) {
            Object val = incoming.get(def.getFieldKey());
            if (Boolean.TRUE.equals(def.getIsRequired())) {
                if (val == null || val.toString().isBlank()) {
                    throw new IllegalArgumentException("必填字段不能为空: " + def.getName());
                }
            }
            if (Boolean.TRUE.equals(def.getIsUnique()) && val != null && !val.toString().isBlank()) {
                int count = instanceMapper.countByFieldValue(tenantId, modelId,
                        def.getFieldKey(), val.toString(), excludeId);
                if (count > 0) {
                    throw new IllegalArgumentException("字段值已存在（唯一约束）: " + def.getName() + "=" + val);
                }
            }
        }
    }

    private String deriveDisplayName(Map<String, Object> attrs, List<CiAttribute> attrDefs) {
        if (attrs == null || attrDefs == null) return null;
        for (CiAttribute def : attrDefs) {
            if (Boolean.TRUE.equals(def.getIsRequired()) && "singlechar".equals(def.getFieldType())) {
                Object v = attrs.get(def.getFieldKey());
                if (v != null && !v.toString().isBlank()) return v.toString();
            }
        }
        for (CiAttribute def : attrDefs) {
            if ("singlechar".equals(def.getFieldType())) {
                Object v = attrs.get(def.getFieldKey());
                if (v != null && !v.toString().isBlank()) return v.toString();
            }
        }
        return null;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private CiInstance findOrThrow(String tenantId, Long id) {
        CiInstance inst = instanceMapper.selectOne(new LambdaQueryWrapper<CiInstance>()
                .eq(CiInstance::getTenantId, tenantId)
                .eq(CiInstance::getId, id)
                .eq(CiInstance::getIsDeleted, false));
        if (inst == null) throw new IllegalArgumentException("CI实例不存在: " + id);
        return inst;
    }

    private CiInstanceVO toVO(CiInstance inst, Map<Long, String> userNames,
                               List<CiAttributeVO> fieldConfig) {
        CiInstanceVO vo = new CiInstanceVO();
        vo.setId(inst.getId());
        vo.setModelId(inst.getModelId());
        vo.setName(inst.getName());
        vo.setAttrs(inst.getAttrs());
        vo.setCreatedAt(inst.getCreatedAt());
        vo.setUpdatedAt(inst.getUpdatedAt());
        vo.setCreatedBy(inst.getCreatedBy());
        if (inst.getCreatedBy() != null) {
            vo.setCreatedByName(userNames.getOrDefault(inst.getCreatedBy(),
                    String.valueOf(inst.getCreatedBy())));
        }
        vo.setFieldConfig(fieldConfig);
        return vo;
    }

    private CiAttributeVO toAttrVO(CiAttribute a) {
        CiAttributeVO vo = new CiAttributeVO();
        vo.setId(a.getId());
        vo.setModelId(a.getModelId());
        vo.setFieldKey(a.getFieldKey());
        vo.setName(a.getName());
        vo.setGroupId(a.getGroupId());
        vo.setFieldType(a.getFieldType());
        vo.setOption(a.getOption());
        vo.setDefaultVal(a.getDefaultVal());
        vo.setPlaceholder(a.getPlaceholder());
        vo.setUnit(a.getUnit());
        vo.setIsRequired(a.getIsRequired());
        vo.setIsEditable(a.getIsEditable());
        vo.setIsUnique(a.getIsUnique());
        vo.setIsBuiltIn(a.getIsBuiltIn());
        vo.setIsListShow(a.getIsListShow());
        vo.setSortOrder(a.getSortOrder());
        return vo;
    }

    private void writeAudit(String tenantId, String action, Long targetId,
                             Long operatorId, String remark) {
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("cmdb").action(action)
                .targetId(targetId).targetType("ci_instance")
                .operatorId(operatorId).remark(remark)
                .createdAt(LocalDateTime.now()).build());
    }
}
