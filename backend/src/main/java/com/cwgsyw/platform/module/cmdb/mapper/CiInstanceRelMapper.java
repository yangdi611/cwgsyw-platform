package com.cwgsyw.platform.module.cmdb.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.cmdb.entity.CiInstanceRel;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface CiInstanceRelMapper extends BaseMapper<CiInstanceRel> {

    /**
     * Recursive CTE for topology traversal (BFS).
     * Returns all relation edges reachable within maxDepth from rootInstanceId.
     */
    @Select("""
        WITH RECURSIVE topo AS (
            SELECT id, src_instance_id, dst_instance_id, association_kind, 0 AS depth
            FROM ci_instance_rel
            WHERE (src_instance_id = #{rootId} OR dst_instance_id = #{rootId})
              AND NOT is_deleted
              AND tenant_id = #{tenantId}
            UNION ALL
            SELECT r.id, r.src_instance_id, r.dst_instance_id, r.association_kind, t.depth + 1
            FROM ci_instance_rel r
            INNER JOIN topo t ON (r.src_instance_id = t.dst_instance_id OR r.dst_instance_id = t.src_instance_id)
            WHERE t.depth < #{maxDepth}
              AND NOT r.is_deleted
              AND r.tenant_id = #{tenantId}
        )
        SELECT DISTINCT id, src_instance_id AS srcInstanceId, dst_instance_id AS dstInstanceId, association_kind AS associationKind
        FROM topo
        """)
    List<CiInstanceRel> findTopologyEdges(@Param("rootId") Long rootInstanceId,
                                          @Param("tenantId") String tenantId,
                                          @Param("maxDepth") int maxDepth);
}
