package com.cwgsyw.platform.module.org;

import com.cwgsyw.platform.module.org.entity.Group;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ActiveGroupReferenceValidator {
    private final GroupMapper groupMapper;

    public Group lockAndRequire(String tenantId, Long groupId) {
        if (groupId == null) return null;
        Group group = groupMapper.lockByTenantAndIdIncludingDeleted(tenantId, groupId);
        if (group == null || Boolean.TRUE.equals(group.getIsDeleted())
                || !"business".equals(group.getGroupType())) {
            throw new GroupLifecycleException(409, "GROUP_REFERENCE_INACTIVE",
                "目标用户组不存在、已归档或不可用于业务引用");
        }
        return group;
    }
}
