package com.cwgsyw.platform.module.cmdb.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Uniqueness validation for CI instance dynamic fields (Issue #64 AC9). Extracted
 * from the former {@code CiInstanceService.validateUniqueFields} private helper so
 * it can be shared by instance create/update and (future) import flows.
 * Behaviour is unchanged from the original implementation.
 */
@Component
@RequiredArgsConstructor
public class CiInstanceUniquenessValidator {

    private final CiInstanceMapper ciInstanceMapper;

    public void validate(Map<String, Object> fieldsData, List<CiAttribute> attrs,
                         String tenantId, String modelId, Long excludeId) {
        for (CiAttribute attr : attrs) {
            if (!Boolean.TRUE.equals(attr.getIsUnique())) continue;
            Object value = fieldsData.get(attr.getFieldKey());
            if (value == null) continue;
            LambdaQueryWrapper<CiInstance> q = new LambdaQueryWrapper<CiInstance>()
                    .eq(CiInstance::getTenantId, tenantId).eq(CiInstance::getModelId, modelId)
                    .eq(CiInstance::getIsDeleted, false)
                    .apply("fields_data->>'" + attr.getFieldKey() + "' = {0}", value.toString());
            if (excludeId != null) q.ne(CiInstance::getId, excludeId);
            if (ciInstanceMapper.selectCount(q) > 0)
                throw new IllegalArgumentException("字段 " + attr.getName() + " 的值已存在: " + value);
        }
    }
}
