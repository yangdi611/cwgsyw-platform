package com.cwgsyw.platform.module.org;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.org.entity.Group;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

@Mapper
public interface GroupMapper extends BaseMapper<Group> {

    @Select("""
        SELECT * FROM sys_group
        WHERE tenant_id = #{tenantId} AND id = #{groupId}
        FOR UPDATE
        """)
    Group lockByTenantAndIdIncludingDeleted(@Param("tenantId") String tenantId,
                                             @Param("groupId") Long groupId);

    @Select("""
        SELECT * FROM sys_group
        WHERE tenant_id = #{tenantId} AND id = #{groupId}
        """)
    Group findByTenantAndIdIncludingDeleted(@Param("tenantId") String tenantId,
                                             @Param("groupId") Long groupId);

    @Select({
        "<script>",
        "SELECT * FROM sys_group",
        "WHERE tenant_id = #{tenantId}",
        "<choose>",
        "<when test='groupIds != null and !groupIds.isEmpty()'>",
        "AND id IN",
        "<foreach collection='groupIds' item='groupId' open='(' separator=',' close=')'>",
        "#{groupId}",
        "</foreach>",
        "</when>",
        "<otherwise>AND 1 = 0</otherwise>",
        "</choose>",
        "ORDER BY id",
        "</script>"
    })
    List<Group> findIncludingDeletedByIds(@Param("tenantId") String tenantId,
                                           @Param("groupIds") Collection<Long> groupIds);

    @Select("""
        SELECT * FROM sys_group
        WHERE tenant_id = #{tenantId} AND is_deleted = TRUE
        ORDER BY deleted_at DESC, id
        """)
    List<Group> listArchived(@Param("tenantId") String tenantId);

    @Select("""
        SELECT COUNT(*) FROM sys_group
        WHERE tenant_id = #{tenantId}
          AND code = #{code}
          AND is_deleted = FALSE
          AND id <> #{groupId}
        """)
    long countActiveCodeConflict(@Param("tenantId") String tenantId,
                                 @Param("code") String code,
                                 @Param("groupId") Long groupId);

    @Select("""
        SELECT COUNT(*) FROM sys_group
        WHERE tenant_id = #{tenantId}
          AND BTRIM(name) = #{name}
          AND is_deleted = FALSE
          AND (CAST(#{groupId} AS BIGINT) IS NULL OR id <> CAST(#{groupId} AS BIGINT))
        """)
    long countActiveNameConflict(@Param("tenantId") String tenantId,
                                 @Param("name") String name,
                                 @Param("groupId") Long groupId);

    @Update("""
        UPDATE sys_group
        SET is_deleted = TRUE,
            deleted_at = NOW(),
            deleted_by = #{operatorId},
            updated_at = NOW(),
            updated_by = #{operatorId}
        WHERE tenant_id = #{tenantId}
          AND id = #{groupId}
          AND is_deleted = FALSE
          AND updated_at = #{expectedUpdatedAt}
        """)
    int archiveActive(@Param("tenantId") String tenantId,
                      @Param("groupId") Long groupId,
                      @Param("operatorId") Long operatorId,
                      @Param("expectedUpdatedAt") LocalDateTime expectedUpdatedAt);

    @Update("""
        UPDATE sys_group
        SET is_deleted = FALSE,
            deleted_at = NULL,
            deleted_by = NULL,
            updated_at = NOW(),
            updated_by = #{operatorId}
        WHERE tenant_id = #{tenantId}
          AND id = #{groupId}
          AND is_deleted = TRUE
          AND updated_at = #{expectedUpdatedAt}
        """)
    int restoreArchived(@Param("tenantId") String tenantId,
                        @Param("groupId") Long groupId,
                        @Param("operatorId") Long operatorId,
                        @Param("expectedUpdatedAt") LocalDateTime expectedUpdatedAt);

    @org.apache.ibatis.annotations.Delete("""
        DELETE FROM sys_group
        WHERE tenant_id = #{tenantId}
          AND id = #{groupId}
          AND is_deleted = TRUE
          AND updated_at = #{expectedUpdatedAt}
        """)
    int hardDeleteArchived(@Param("tenantId") String tenantId,
                           @Param("groupId") Long groupId,
                           @Param("expectedUpdatedAt") LocalDateTime expectedUpdatedAt);
}
