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
            SELECT r.id, r.src_id, r.dst_id, r.def_id, 0 AS depth
            FROM ci_instance_rel r, params p
            WHERE (r.src_id = p.p_root_id OR r.dst_id = p.p_root_id)
              AND NOT r.is_deleted
              AND r.tenant_id = p.p_tenant_id
            UNION ALL
            SELECT r.id, r.src_id, r.dst_id, r.def_id, t.depth + 1
            FROM ci_instance_rel r
            INNER JOIN topo t ON (r.src_id = t.dst_id OR r.dst_id = t.src_id)
            INNER JOIN params p ON true
            WHERE t.depth < p.p_max_depth
              AND NOT r.is_deleted
              AND r.tenant_id = p.p_tenant_id
        )
        SELECT DISTINCT id, src_id AS srcInstanceId, dst_id AS dstInstanceId, def_id AS defId
        FROM topo
        """)
    List<CiInstanceRel> findTopologyEdges(@Param("rootId") Long rootInstanceId,
                                          @Param("tenantId") String tenantId,
                                          @Param("maxDepth") int maxDepth);

    /**
     * Aggregate worker-node capacity for a resource_pool instance.
     *
     * Counts and sums host CIs reachable through `host belong resource_pool`
     * relations, filtered by host.attrs.node_role='worker'. CPU/memory totals
     * come from host.attrs.cpu_cores and host.attrs.mem_gb (host built-in
     * attributes). Returns columns:
     *   worker_count            BIGINT — all workers in pool
     *   schedulable_worker_count BIGINT — workers with scheduling_state='schedulable' (or unset)
     *   worker_cpu_cores        BIGINT — sum of cpu_cores across all workers
     *   worker_memory_gb        BIGINT — sum of mem_gb across all workers
     */
    @Select("""
        SELECT
          COUNT(*) FILTER (WHERE COALESCE(h.attrs->>'node_role','worker') = 'worker') AS worker_count,
          COUNT(*) FILTER (WHERE COALESCE(h.attrs->>'node_role','worker') = 'worker'
                             AND COALESCE(h.attrs->>'scheduling_state','schedulable') = 'schedulable') AS schedulable_worker_count,
          COALESCE(SUM((h.attrs->>'cpu_cores')::int) FILTER (WHERE COALESCE(h.attrs->>'node_role','worker') = 'worker'), 0) AS worker_cpu_cores,
          COALESCE(SUM((h.attrs->>'mem_gb')::int) FILTER (WHERE COALESCE(h.attrs->>'node_role','worker') = 'worker'), 0) AS worker_memory_gb
        FROM ci_instance_rel r
        JOIN ci_association_def d ON d.def_id = r.def_id AND NOT d.is_deleted
        JOIN ci_instance h ON h.id = r.src_id AND NOT h.is_deleted
        WHERE r.dst_id = #{poolId}
          AND r.tenant_id = #{tenantId}
          AND NOT r.is_deleted
          AND d.def_id = 'host_belong_resource_pool'
        """)
    java.util.Map<String, Object> aggregateResourcePoolWorkers(@Param("poolId") Long poolId,
                                                               @Param("tenantId") String tenantId);

    /**
     * 机柜成员查询（spec §5.1）：返回 rack 实例通过 {@code rack_contains_*} 边直连的所有设备，
     * 含设备 U 位（attrs.u_start/u_end）、资产编号、模型配色/显示名。
     *
     * <p>U 位用 {@code NULLIF(...,'')::int} 防空串转换异常；未登记 U 位的设备 u_start/u_end 为 null，
     * 由 Service 归入「未定位」并产生 missing_u 告警。仅取 rack 作为 src 的边（方向天然匹配，§5.5）。
     */
    @Select("""
        SELECT i.id                                       AS id,
               i.model_id                                 AS modelId,
               i.name                                     AS name,
               i.status                                   AS status,
               m.color                                    AS modelColor,
               m.display_name                             AS modelName,
               NULLIF(i.attrs->>'u_start','')::int        AS uStart,
               NULLIF(i.attrs->>'u_end','')::int          AS uEnd,
               i.attrs->>'asset_no'                       AS assetNo
        FROM ci_instance_rel r
        JOIN ci_instance i ON i.id = r.dst_id AND NOT i.is_deleted
        JOIN ci_model m ON m.tenant_id = r.tenant_id AND m.model_id = i.model_id AND NOT m.is_deleted
        WHERE r.src_id = #{rackId}
          AND r.tenant_id = #{tenantId}
          AND NOT r.is_deleted
          AND r.def_id LIKE 'rack_contains_%'
        ORDER BY uStart NULLS LAST, i.name
        """)
    List<com.cwgsyw.platform.module.cmdb.dto.rack.RackMemberRow> findRackMembers(
            @Param("rackId") Long rackId, @Param("tenantId") String tenantId);
}

