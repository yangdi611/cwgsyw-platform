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
     * Returns all relation edges reachable within the configured depth from the
     * root instance.
     *
     * NOTE: Each MyBatis parameter binding appears EXACTLY ONCE in the SQL.
     * The three bound values are funneled through a `params` CTE and referenced
     * by alias thereafter. This is required because the PostgreSQL JDBC driver
     * (42.7.x) miscounts JDBC placeholders when the same named parameter is
     * reused inside a recursive CTE, producing
     * "No value specified for parameter N". See CiInstanceRelMapperTest for the
     * regression guard enforcing this invariant.
     */
    @Select("""
        WITH RECURSIVE
        params AS (
            SELECT #{rootId}::bigint AS p_root_id,
                   #{tenantId}::varchar AS p_tenant_id,
                   #{maxDepth}::int AS p_max_depth
        ),
        topo AS (
            SELECT r.id, r.src_instance_id, r.dst_instance_id, r.association_kind, 0 AS depth
            FROM ci_instance_rel r, params p
            WHERE (r.src_instance_id = p.p_root_id OR r.dst_instance_id = p.p_root_id)
              AND NOT r.is_deleted
              AND r.tenant_id = p.p_tenant_id
            UNION ALL
            SELECT r.id, r.src_instance_id, r.dst_instance_id, r.association_kind, t.depth + 1
            FROM ci_instance_rel r
            INNER JOIN topo t ON (r.src_instance_id = t.dst_instance_id OR r.dst_instance_id = t.src_instance_id)
            INNER JOIN params p ON true
            WHERE t.depth < p.p_max_depth
              AND NOT r.is_deleted
              AND r.tenant_id = p.p_tenant_id
        )
        SELECT DISTINCT id, src_instance_id AS srcInstanceId, dst_instance_id AS dstInstanceId, association_kind AS associationKind
        FROM topo
        """)
    List<CiInstanceRel> findTopologyEdges(@Param("rootId") Long rootInstanceId,
                                          @Param("tenantId") String tenantId,
                                          @Param("maxDepth") int maxDepth);
}
