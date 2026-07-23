package com.cwgsyw.platform.module.task.plan.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.entity.CiModel;
import com.cwgsyw.platform.module.cmdb.entity.CiModelGroup;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelGroupMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import com.cwgsyw.platform.module.task.plan.dto.CiScopeRequest;
import com.cwgsyw.platform.module.task.plan.dto.CiScopeResolution;
import com.cwgsyw.platform.module.task.plan.dto.CiScopeSelection;
import com.cwgsyw.platform.module.task.plan.dto.ResolvedCiInstance;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class CiScopeResolver {
    public static final int DEFAULT_LIMIT = 100;
    public static final int MAX_RESOLUTION_SIZE = 10_000;
    private static final Set<String> LEVELS = Set.of("model_group", "model", "instance");

    private final CiModelGroupMapper groupMapper;
    private final CiModelMapper modelMapper;
    private final CiInstanceMapper instanceMapper;

    public CiScopeResolution resolve(String tenantId, CiScopeRequest request) {
        int limit = request.limit() == null ? DEFAULT_LIMIT : Math.min(MAX_RESOLUTION_SIZE, request.limit());
        List<CiScopeSelection> normalized = normalize(request.selections());
        Catalog catalog = catalog(tenantId);
        validateSelections(normalized, catalog);

        Set<String> selectedGroups = keys(normalized, "model_group");
        Set<String> selectedModels = keys(normalized, "model");
        Set<Long> selectedInstances = longKeys(normalized, "instance");
        List<String> warnings = new ArrayList<>();

        selectedModels.removeIf(modelCode -> {
            CiModel model = catalog.models().get(modelCode);
            if (selectedGroups.contains(model.getGroupCode())) {
                warnings.add("模型 " + modelCode + " 已被模型组 " + model.getGroupCode() + " 覆盖");
                return true;
            }
            return false;
        });

        Map<Long, CiInstance> chosen = new LinkedHashMap<>();
        for (CiInstance instance : catalog.instances()) {
            CiModel model = catalog.models().get(instance.getModelId());
            if (model != null && (selectedGroups.contains(model.getGroupCode()) || selectedModels.contains(model.getModelId()))) {
                chosen.put(instance.getId(), instance);
            }
        }
        for (Long instanceId : selectedInstances) {
            CiInstance instance = catalog.instancesById().get(instanceId);
            CiModel model = catalog.models().get(instance.getModelId());
            if (chosen.containsKey(instanceId)) {
                warnings.add("CI " + instance.getName() + " 已被上级范围覆盖");
            } else if (matchesFilters(instance, request.filters())) {
                chosen.put(instanceId, instance);
            }
        }

        List<CiInstance> filtered = chosen.values().stream()
            .filter(instance -> matchesFilters(instance, request.filters()))
            .sorted(Comparator.comparing(CiInstance::getName, Comparator.nullsLast(String::compareToIgnoreCase))
                .thenComparing(CiInstance::getId))
            .toList();
        if (filtered.size() > MAX_RESOLUTION_SIZE) {
            throw BusinessException.badRequest("CI_SCOPE_TOO_LARGE", "CI 范围超过 " + MAX_RESOLUTION_SIZE + " 条，请缩小选择或增加过滤条件");
        }

        List<CiScopeSelection> effectiveSelections = new ArrayList<>();
        selectedGroups.stream().sorted().map(key -> new CiScopeSelection("model_group", key)).forEach(effectiveSelections::add);
        selectedModels.stream().sorted().map(key -> new CiScopeSelection("model", key)).forEach(effectiveSelections::add);
        selectedInstances.stream().filter(id -> !chosen.containsKey(id) || !coveredByParent(catalog.instancesById().get(id), catalog.models(), selectedGroups, selectedModels))
            .sorted().map(id -> new CiScopeSelection("instance", String.valueOf(id))).forEach(effectiveSelections::add);
        List<ResolvedCiInstance> instances = filtered.stream().limit(limit).map(instance -> toResolved(instance, catalog)).toList();
        return new CiScopeResolution(List.copyOf(effectiveSelections), filtered.size(), filtered.size() > limit,
            instances, List.copyOf(new LinkedHashSet<>(warnings)));
    }

    private Catalog catalog(String tenantId) {
        List<CiModelGroup> groups = groupMapper.selectList(new LambdaQueryWrapper<CiModelGroup>()
            .eq(CiModelGroup::getTenantId, tenantId).eq(CiModelGroup::getIsDeleted, false));
        List<CiModel> models = modelMapper.selectList(new LambdaQueryWrapper<CiModel>()
            .eq(CiModel::getTenantId, tenantId).eq(CiModel::getIsDeleted, false));
        List<CiInstance> instances = instanceMapper.selectList(new LambdaQueryWrapper<CiInstance>()
            .eq(CiInstance::getTenantId, tenantId).eq(CiInstance::getIsDeleted, false));
        return new Catalog(index(groups, CiModelGroup::getCode), index(models, CiModel::getModelId),
            instances, index(instances, CiInstance::getId));
    }

    private void validateSelections(List<CiScopeSelection> selections, Catalog catalog) {
        for (CiScopeSelection selection : selections) {
            if (!LEVELS.contains(selection.level())) {
                throw BusinessException.badRequest("INVALID_CI_SCOPE_LEVEL", "不支持的 CI 选择层级: " + selection.level());
            }
            boolean exists = switch (selection.level()) {
                case "model_group" -> catalog.groups().containsKey(selection.key());
                case "model" -> catalog.models().containsKey(selection.key());
                case "instance" -> catalog.instancesById().containsKey(parseId(selection.key()));
                default -> false;
            };
            if (!exists) throw BusinessException.badRequest("CI_SCOPE_TARGET_NOT_FOUND", "CI 范围对象不存在或无权访问: " + selection.key());
        }
    }

    private List<CiScopeSelection> normalize(Collection<CiScopeSelection> selections) {
        LinkedHashMap<String, CiScopeSelection> values = new LinkedHashMap<>();
        for (CiScopeSelection selection : selections) {
            String level = selection.level() == null ? "" : selection.level().trim().toLowerCase();
            String key = selection.key() == null ? "" : selection.key().trim();
            if (key.isBlank()) throw BusinessException.badRequest("INVALID_CI_SCOPE", "CI 范围 key 不能为空");
            values.put(level + ':' + key, new CiScopeSelection(level, key));
        }
        return List.copyOf(values.values());
    }

    private boolean matchesFilters(CiInstance instance, Map<String, Object> filters) {
        if (filters == null || filters.isEmpty()) return true;
        Set<String> statuses = stringSet(filters.get("status"));
        if (!statuses.isEmpty() && !statuses.contains(instance.getStatus())) return false;
        String owner = filters.get("owner") == null ? null : String.valueOf(filters.get("owner"));
        return !StringUtils.hasText(owner) || owner.equals(instance.getOwner());
    }

    private ResolvedCiInstance toResolved(CiInstance instance, Catalog catalog) {
        CiModel model = catalog.models().get(instance.getModelId());
        CiModelGroup group = model == null ? null : catalog.groups().get(model.getGroupCode());
        return new ResolvedCiInstance(instance.getId(), instance.getName(), instance.getModelId(),
            model == null ? instance.getModelId() : displayName(model), model == null ? null : model.getGroupCode(),
            group == null ? null : group.getName(), instance.getStatus(), instance.getOwner());
    }

    private boolean coveredByParent(CiInstance instance, Map<String, CiModel> models,
                                    Set<String> groups, Set<String> selectedModels) {
        CiModel model = models.get(instance.getModelId());
        return model != null && (selectedModels.contains(model.getModelId()) || groups.contains(model.getGroupCode()));
    }

    private String displayName(CiModel model) {
        return StringUtils.hasText(model.getDisplayName()) ? model.getDisplayName() : model.getName();
    }

    private Set<String> keys(List<CiScopeSelection> selections, String level) {
        Set<String> values = new LinkedHashSet<>();
        selections.stream().filter(selection -> level.equals(selection.level())).map(CiScopeSelection::key).forEach(values::add);
        return values;
    }

    private Set<Long> longKeys(List<CiScopeSelection> selections, String level) {
        Set<Long> values = new LinkedHashSet<>();
        selections.stream().filter(selection -> level.equals(selection.level())).map(CiScopeSelection::key).map(this::parseId).forEach(values::add);
        return values;
    }

    private Long parseId(String value) {
        try {
            return Long.valueOf(value);
        } catch (NumberFormatException exception) {
            throw BusinessException.badRequest("INVALID_CI_INSTANCE_ID", "CI 实例 ID 无效: " + value);
        }
    }

    private Set<String> stringSet(Object value) {
        if (!(value instanceof Iterable<?> iterable)) return Set.of();
        Set<String> result = new LinkedHashSet<>();
        iterable.forEach(item -> result.add(String.valueOf(item)));
        return result;
    }

    private <K, V> Map<K, V> index(Collection<V> values, java.util.function.Function<V, K> key) {
        Map<K, V> result = new LinkedHashMap<>();
        values.forEach(value -> result.put(key.apply(value), value));
        return result;
    }

    private record Catalog(
        Map<String, CiModelGroup> groups,
        Map<String, CiModel> models,
        List<CiInstance> instances,
        Map<Long, CiInstance> instancesById
    ) {
    }
}
