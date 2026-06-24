package com.cwgsyw.platform.module.sharedfile;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.sharedfile.entity.SharedFolder;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface SharedFolderMapper extends BaseMapper<SharedFolder> {
    @Select("SELECT * FROM shared_folder WHERE tenant_id = #{tenantId} AND is_deleted = FALSE ORDER BY name")
    List<SharedFolder> findAllByTenant(@Param("tenantId") String tenantId);

    /**
     * 自下而上返回 folderId 自身 + 所有祖先（depth=0 为自身，越往上 depth 越大），
     * 仅含未删除节点。用于 ACL 覆盖式继承：取第一个 acl_inherited=false 的节点。
     */
    @Select("""
            WITH RECURSIVE chain AS (
                SELECT id, parent_id, acl_inherited, is_deleted, 0 AS depth
                FROM shared_folder WHERE id = #{folderId} AND tenant_id = #{tenantId}
                UNION ALL
                SELECT f.id, f.parent_id, f.acl_inherited, f.is_deleted, c.depth + 1
                FROM shared_folder f JOIN chain c ON f.id = c.parent_id
                WHERE f.tenant_id = #{tenantId}
            )
            SELECT * FROM chain WHERE is_deleted = FALSE ORDER BY depth
            """)
    List<SharedFolder> findAncestorChain(@Param("tenantId") String tenantId, @Param("folderId") Long folderId);
}
