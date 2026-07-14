package com.cwgsyw.platform.module.authorization;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ResourceAclMapper {
    @Select("""
        SELECT subject_type, subject_id, permissions
        FROM resource_acl_entry
        WHERE tenant_id = #{tenantId} AND resource_type = #{resourceType}
          AND resource_id = #{resourceId} AND entry_type = 'access' AND NOT is_deleted
        """)
    List<ResourceAclRow> findAccessEntries(String tenantId, String resourceType, Long resourceId);

    record ResourceAclRow(String subjectType, Long subjectId, int permissions) {}
}
