package com.cwgsyw.platform.module.cmdb.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.dto.attribute.CiAttributeVO;
import com.cwgsyw.platform.module.cmdb.dto.history.ChangeHistoryVO;
import com.cwgsyw.platform.module.cmdb.dto.instance.*;
import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import com.cwgsyw.platform.module.cmdb.entity.CiAttributeGroup;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.entity.CiModel;
import com.cwgsyw.platform.module.cmdb.mapper.*;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Read side of the former {@code CiInstanceService} (Issue #64 AC9): list,
 * detail, search, and audit-log-backed change history queries. Write paths live
 * in {@link CiInstanceCommandService}; cross-module related-resource lookups
 * live in {@link CiRelatedResourceService}. Behaviour is unchanged.
 */
@Service
@RequiredArgsConstructor
public class CiInstanceQueryService {

    private final CiInstanceMapper ciInstanceMapper;
    private final CiModelMapper ciModelMapper;
    private final CiAttributeMapper ciAttributeMapper;
    private final CiAttributeGroupMapper ciAttributeGroupMapper;
    private final CiInstanceRelMapper ciInstanceRelMapper;
    private final AuditLogMapper auditLogMapper;
    private final UserMapper userMapper;
    private final ObjectMapper objectMapper;

    public PageResult<CiInstanceVO> list(String model, String keyword, String status,
                                         int page, int size, String tenantId) {
        // 跨模型查询：model 为空时返回所有模型的实例
        LambdaQueryWrapper<CiInstance> query = new LambdaQueryWrapper<CiInstance>()
                .eq(CiInstance::getTenantId, tenantId)
                .eq(CiInstance::getIsDeleted, false)
                .orderByDesc(CiInstance::getUpdatedAt);

        if (model != null && !model.isBlank()) {
            query.eq(CiInstance::getModelId, model);
        }
        if (keyword != null && !keyword.isBlank()) {
            query.and(w -> w.like(CiInstance::getName, keyword));
        }
        if (status != null && !status.isBlank()) {
            query.eq(CiInstance::getStatus, status);
        }

        Page<CiInstance> p = ciInstanceMapper.selectPage(new Page<>(page, size), query);

        // 批量加载 model displayName
        Map<String, String> modelDisplayNames = new HashMap<>();
        Set<String> modelIds = p.getRecords().stream().map(CiInstance::getModelId).collect(Collectors.toSet());
        for (String modelId : modelIds) {
            ciModelMapper.findByName(modelId, tenantId)
                    .ifPresent(m -> modelDisplayNames.put(m.getModelId(), m.getDisplayName()));
        }

        // 按模型分组加载 listShowKeys（跨模型时每个模型的 listShowKeys 不同）
        Map<String, Set<String>> listShowKeysByModel = new HashMap<>();
        for (String modelId : modelIds) {
            Set<String> keys = ciAttributeMapper.listByModel(modelId, tenantId).stream()
                    .filter(a -> Boolean.TRUE.equals(a.getIsListShow()))
                    .map(CiAttribute::getFieldKey).collect(Collectors.toSet());
            listShowKeysByModel.put(modelId, keys);
        }

        return PageResult.of(p.convert(inst -> toListVO(
                inst,
                modelDisplayNames.getOrDefault(inst.getModelId(), inst.getModelId()),
                listShowKeysByModel.getOrDefault(inst.getModelId(), Set.of())
        )));
    }

    public CiInstanceDetailVO getDetail(Long id, String tenantId) {
        CiInstance inst = loadInstance(id, tenantId);
        CiModel model = loadModel(inst.getModelId(), tenantId);
        Map<String, String> attrGroupNames = resolveAttrGroupNames(tenantId);

        List<CiAttributeVO> attrVOs = ciAttributeMapper.listByModel(model.getModelId(), tenantId).stream()
                .map(a -> toAttributeVO(a, attrGroupNames)).collect(Collectors.toList());

        Map<String, Object> fieldsData = inst.getFieldsData();
        if ("resource_pool".equals(inst.getModelId())) {
            fieldsData = injectResourcePoolDerivedFields(inst.getId(), fieldsData, tenantId);
        }

        CiInstanceDetailVO vo = new CiInstanceDetailVO();
        vo.setId(inst.getId()); vo.setName(inst.getName());
        vo.setModelCode(inst.getModelId()); vo.setModelId(inst.getModelId());
        vo.setDisplayName(model.getDisplayName()); vo.setModelName(model.getDisplayName());
        vo.setStatus(inst.getStatus()); vo.setOwner(inst.getOwner());
        vo.setDescription(inst.getDescription()); vo.setFieldsData(fieldsData);
        vo.setAttributes(attrVOs); vo.setCreatedAt(inst.getCreatedAt()); vo.setUpdatedAt(inst.getUpdatedAt());
        return vo;
    }

    /**
     * Aggregate worker host capacity for a resource_pool and overlay the result
     * onto the pool's fieldsData under reserved keys (`_worker_count`, etc.).
     * Reserved keys are surfaced read-only by the frontend; they cannot collide
     * with user-defined attribute keys (which must match {@code ^[a-z][a-z0-9_]*$}).
     */
    private Map<String, Object> injectResourcePoolDerivedFields(Long poolId,
                                                                Map<String, Object> fieldsData,
                                                                String tenantId) {
        Map<String, Object> agg = ciInstanceRelMapper.aggregateResourcePoolWorkers(poolId, tenantId);
        Map<String, Object> merged = fieldsData == null ? new LinkedHashMap<>() : new LinkedHashMap<>(fieldsData);
        if (agg != null) {
            merged.put("_worker_count", agg.getOrDefault("worker_count", 0L));
            merged.put("_schedulable_worker_count", agg.getOrDefault("schedulable_worker_count", 0L));
            merged.put("_worker_cpu_cores", agg.getOrDefault("worker_cpu_cores", 0L));
            merged.put("_worker_memory_gb", agg.getOrDefault("worker_memory_gb", 0L));
        }
        return merged;
    }

    public PageResult<CiInstanceSearchVO> search(String keyword, int size, String tenantId) {
        // 跨模型搜索：匹配实例名 或 JSONB attrs 文本（覆盖 inner_ip 等 IP 属性）。
        // attrs::text ILIKE 用参数绑定（{0}），keyword 作为字面量，无注入风险。
        String kw = "%" + keyword + "%";
        LambdaQueryWrapper<CiInstance> query = new LambdaQueryWrapper<CiInstance>()
                .eq(CiInstance::getTenantId, tenantId).eq(CiInstance::getIsDeleted, false)
                .and(w -> w.like(CiInstance::getName, keyword)
                        .or()
                        .apply("attrs::text ILIKE {0}", kw))
                .orderByDesc(CiInstance::getUpdatedAt)
                .last("LIMIT " + size);

        List<CiInstance> records = ciInstanceMapper.selectList(query);
        Map<String, String> modelNames = new HashMap<>();
        for (CiInstance inst : records) {
            if (!modelNames.containsKey(inst.getModelId())) {
                ciModelMapper.findByName(inst.getModelId(), tenantId)
                        .ifPresent(m -> modelNames.put(m.getModelId(), m.getDisplayName()));
            }
        }

        List<CiInstanceSearchVO> vos = records.stream().map(inst -> {
            CiInstanceSearchVO vo = new CiInstanceSearchVO();
            vo.setId(inst.getId()); vo.setName(inst.getName());
            vo.setModelCode(inst.getModelId());
            vo.setModelId(inst.getModelId());
            vo.setModelName(modelNames.getOrDefault(inst.getModelId(), inst.getModelId()));
            vo.setSnippet(matchSnippet(inst.getFieldsData(), keyword));
            return vo;
        }).collect(Collectors.toList());

        PageResult<CiInstanceSearchVO> result = new PageResult<>();
        result.setRecords(vos); result.setTotal(vos.size()); result.setPage(1); result.setSize(size);
        return result;
    }

    public PageResult<ChangeHistoryVO> getInstanceHistory(Long instanceId, int page, int size, String tenantId) {
        Page<AuditLog> result = auditLogMapper.queryPage(new Page<>(page, size), tenantId, "cmdb", null, null, null);

        List<AuditLog> filtered = result.getRecords().stream()
                .filter(a -> "ci_instance".equals(a.getTargetType()) && instanceId.equals(a.getTargetId()))
                .collect(Collectors.toList());

        Map<Long, String> operatorNames = resolveUserNames(filtered.stream()
                .map(AuditLog::getOperatorId).filter(id -> id != null && id > 0).collect(Collectors.toSet()));

        List<ChangeHistoryVO> historyVOs = filtered.stream().map(a -> {
            ChangeHistoryVO vo = new ChangeHistoryVO();
            vo.setId(a.getId()); vo.setAction(a.getAction()); vo.setOperatorId(a.getOperatorId());
            vo.setOperatorName(operatorNames.getOrDefault(a.getOperatorId(), "系统"));
            vo.setBeforeJson(parseJson(a.getBeforeJson())); vo.setAfterJson(parseJson(a.getAfterJson()));
            vo.setCreatedAt(a.getCreatedAt());
            return vo;
        }).collect(Collectors.toList());

        PageResult<ChangeHistoryVO> pr = new PageResult<>();
        pr.setRecords(historyVOs); pr.setTotal(result.getTotal()); pr.setPage(page); pr.setSize(size);
        return pr;
    }

    public PageResult<ChangeHistoryVO> getGlobalChanges(String model, Long operatorId,
            String startDate, String endDate, int page, int size, String tenantId) {
        Page<AuditLog> result = auditLogMapper.queryPage(new Page<>(page, size), tenantId, "cmdb", operatorId, startDate, endDate);

        Map<Long, String> operatorNames = resolveUserNames(result.getRecords().stream()
                .map(AuditLog::getOperatorId).filter(id -> id != null && id > 0).collect(Collectors.toSet()));

        List<ChangeHistoryVO> vos = result.getRecords().stream()
                .filter(a -> a.getTargetType() != null && a.getTargetType().startsWith("ci_"))
                .map(a -> {
                    ChangeHistoryVO vo = new ChangeHistoryVO();
                    vo.setId(a.getId()); vo.setAction(a.getAction()); vo.setOperatorId(a.getOperatorId());
                    vo.setOperatorName(operatorNames.getOrDefault(a.getOperatorId(), "系统"));
                    vo.setBeforeJson(parseJson(a.getBeforeJson())); vo.setAfterJson(parseJson(a.getAfterJson()));
                    vo.setCreatedAt(a.getCreatedAt());
                    return vo;
                }).collect(Collectors.toList());

        PageResult<ChangeHistoryVO> pr = new PageResult<>();
        pr.setRecords(vos); pr.setTotal(result.getTotal()); pr.setPage(page); pr.setSize(size);
        return pr;
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    /**
     * 当搜索关键词匹配到 attrs 内的属性值（而非实例名）时，返回第一个命中属性的
     * {@code key: value} 字符串（大小写不敏感），用于展示命中原因（如 IP 命中
     * 返回 {@code "inner_ip: 10.0.0.1"}）。按名称命中或无命中时返回 {@code null}。
     */
    private String matchSnippet(Map<String, Object> attrs, String keyword) {
        if (attrs == null || attrs.isEmpty() || keyword == null) return null;
        String kw = keyword.toLowerCase();
        for (Map.Entry<String, Object> e : attrs.entrySet()) {
            if (e.getValue() == null) continue;
            String v = e.getValue().toString();
            if (v.toLowerCase().contains(kw)) return e.getKey() + ": " + v;
        }
        return null;
    }

    private CiModel loadModel(String modelCode, String tenantId) {
        return ciModelMapper.findByName(modelCode, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("模型不存在: " + modelCode));
    }

    private CiInstance loadInstance(Long id, String tenantId) {
        CiInstance inst = ciInstanceMapper.selectById(id);
        if (inst == null || inst.getIsDeleted() || !inst.getTenantId().equals(tenantId))
            throw new IllegalArgumentException("实例不存在");
        return inst;
    }

    private Map<String, String> resolveAttrGroupNames(String tenantId) {
        LambdaQueryWrapper<CiAttributeGroup> q = new LambdaQueryWrapper<CiAttributeGroup>()
                .eq(CiAttributeGroup::getTenantId, tenantId).eq(CiAttributeGroup::getIsDeleted, false);
        return ciAttributeGroupMapper.selectList(q).stream()
                .collect(Collectors.toMap(g -> g.getModelId() + ":" + g.getCode(), CiAttributeGroup::getName));
    }

    private Map<Long, String> resolveUserNames(Set<Long> userIds) {
        if (userIds.isEmpty()) return Map.of();
        return userMapper.selectBatchIds(userIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u.getRealName() != null ? u.getRealName() : u.getUsername(), (a, b) -> a));
    }

    private CiAttributeVO toAttributeVO(CiAttribute a, Map<String, String> attrGroupNames) {
        CiAttributeVO vo = new CiAttributeVO();
        vo.setId(a.getId()); vo.setModelId(a.getModelId()); vo.setFieldKey(a.getFieldKey());
        vo.setName(a.getName()); vo.setGroupId(a.getGroupId());
        vo.setGroupName(attrGroupNames.get(a.getModelId() + ":" + a.getGroupId()));
        vo.setFieldType(a.getFieldType()); vo.setIsRequired(a.getIsRequired());
        vo.setIsEditable(a.getIsEditable()); vo.setIsUnique(a.getIsUnique());
        vo.setIsBuiltIn(a.getIsBuiltIn()); vo.setIsListShow(a.getIsListShow());
        vo.setDefaultValue(a.getDefaultValue()); vo.setEnumOptions(a.getEnumOptions());
        vo.setOption(a.getOption());
        vo.setSortOrder(a.getSortOrder());
        return vo;
    }

    private CiInstanceVO toListVO(CiInstance inst, String modelName, Set<String> listShowKeys) {
        CiInstanceVO vo = new CiInstanceVO();
        vo.setId(inst.getId()); vo.setName(inst.getName());
        vo.setModelCode(inst.getModelId()); vo.setModelId(inst.getModelId());
        vo.setDisplayName(modelName); vo.setModelName(modelName);
        vo.setStatus(inst.getStatus());
        vo.setOwner(inst.getOwner()); vo.setDescription(inst.getDescription());
        if (inst.getFieldsData() != null && !listShowKeys.isEmpty()) {
            Map<String, Object> filtered = new LinkedHashMap<>();
            for (String key : listShowKeys) {
                if (inst.getFieldsData().containsKey(key)) filtered.put(key, inst.getFieldsData().get(key));
            }
            vo.setFieldsData(filtered);
        }
        vo.setCreatedAt(inst.getCreatedAt()); vo.setUpdatedAt(inst.getUpdatedAt());
        return vo;
    }

    private Map<String, Object> parseJson(String json) {
        if (json == null || json.isBlank()) return null;
        try { return objectMapper.readValue(json, new TypeReference<>() {}); }
        catch (Exception e) { return null; }
    }
}
