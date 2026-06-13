package com.cwgsyw.platform.module.cmdb.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.cmdb.dto.instance.GroupableAttrVO;
import com.cwgsyw.platform.module.cmdb.dto.instance.TwoDimCellVO;
import com.cwgsyw.platform.module.cmdb.dto.instance.TwoDimGroupVO;
import com.cwgsyw.platform.module.cmdb.dto.instance.TwoDimensionViewVO;
import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.entity.CiModel;
import com.cwgsyw.platform.module.cmdb.mapper.CiAttributeMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class Ci2DViewService {

    private static final Set<String> GROUPABLE_FIELD_TYPES = Set.of("singlechar", "enum");
    private static final String UNGROUPED_LABEL = "__未分组__";

    private final CiModelMapper ciModelMapper;
    private final CiAttributeMapper ciAttributeMapper;
    private final CiInstanceMapper ciInstanceMapper;

    public TwoDimensionViewVO get2DView(String modelId, String groupBy, String tenantId) {
        // 1. Load model and verify enable_2d_view
        CiModel model = ciModelMapper.findByName(modelId, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("模型不存在: " + modelId));

        if (!Boolean.TRUE.equals(model.getEnable2dView())) {
            throw new IllegalArgumentException("该模型未启用 2D 视图");
        }

        // 2. Load attributes, filter groupable
        List<CiAttribute> attrs = ciAttributeMapper.listByModel(modelId, tenantId);
        List<CiAttribute> groupableAttrs = attrs.stream()
                .filter(a -> GROUPABLE_FIELD_TYPES.contains(a.getFieldType()))
                .collect(Collectors.toList());

        // 3. Validate groupBy
        CiAttribute groupByAttr = groupableAttrs.stream()
                .filter(a -> a.getFieldKey().equals(groupBy))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "属性 " + groupBy + " 不支持分组（仅 string/enum 类型可分组）"));

        // 4. Load all instances (not deleted)
        LambdaQueryWrapper<CiInstance> query = new LambdaQueryWrapper<CiInstance>()
                .eq(CiInstance::getTenantId, tenantId)
                .eq(CiInstance::getModelId, modelId)
                .eq(CiInstance::getIsDeleted, false);
        List<CiInstance> instances = ciInstanceMapper.selectList(query);

        // 5. Group by fieldsData[groupBy], null → "__未分组__"
        LinkedHashMap<String, List<TwoDimCellVO>> groups = new LinkedHashMap<>();
        for (CiInstance inst : instances) {
            String groupValue = resolveGroupValue(inst, groupBy);
            groups.computeIfAbsent(groupValue, k -> new ArrayList<>())
                    .add(toCell(inst));
        }

        // Sort each group by name
        for (List<TwoDimCellVO> cells : groups.values()) {
            cells.sort(Comparator.comparing(TwoDimCellVO::getName));
        }

        // 6. Build response
        TwoDimensionViewVO vo = new TwoDimensionViewVO();
        vo.setModelId(modelId);
        vo.setModelName(model.getDisplayName());
        vo.setGroupBy(groupBy);
        vo.setGroups(groups.entrySet().stream()
                .map(e -> {
                    TwoDimGroupVO group = new TwoDimGroupVO();
                    group.setGroupValue(e.getKey());
                    group.setInstances(e.getValue());
                    return group;
                })
                .collect(Collectors.toList()));
        vo.setGroupableAttrs(groupableAttrs.stream()
                .map(a -> {
                    GroupableAttrVO ga = new GroupableAttrVO();
                    ga.setFieldKey(a.getFieldKey());
                    ga.setName(a.getName());
                    ga.setFieldType(a.getFieldType());
                    return ga;
                })
                .collect(Collectors.toList()));

        return vo;
    }

    private String resolveGroupValue(CiInstance inst, String groupBy) {
        if (inst.getFieldsData() == null) return UNGROUPED_LABEL;
        Object value = inst.getFieldsData().get(groupBy);
        if (value == null) return UNGROUPED_LABEL;
        return value.toString();
    }

    private TwoDimCellVO toCell(CiInstance inst) {
        TwoDimCellVO cell = new TwoDimCellVO();
        cell.setId(inst.getId());
        cell.setName(inst.getName());
        cell.setStatus(inst.getStatus());
        cell.setOwner(inst.getOwner());
        return cell;
    }
}
