package com.cwgsyw.platform.module.cmdb.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.module.cmdb.entity.CiChangeRecord;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

/**
 * Mapper for {@link CiChangeRecord} (Issue #64 AC6).
 *
 * <p>Reads the dedicated {@code ci_change_record} table that replaces
 * {@code audit_log} as the data source for CMDB change history / stats.
 *
 * <p><b>Action mapping:</b> the table stores canonical actions
 * {@code create|update|delete|relate}. Callers pass {@code targetTypes}
 * ({@code "ci_instance"} / {@code "ci_instance_rel"}) — the derived virtual
 * target type is computed in SQL so instance actions (create/update/delete)
 * map to {@code ci_instance} and {@code relate} maps to {@code ci_instance_rel}.
 */
@Mapper
public interface CiChangeRecordMapper extends BaseMapper<CiChangeRecord> {

    /**
     * Paginated change query. Mirrors {@code AuditLogMapper.queryChanges} but
     * reads {@code ci_change_record}. {@code targetTypes} filters via the
     * derived target type; {@code modelId} filters {@code model_code} directly
     * (no sub-query on {@code ci_instance} needed).
     */
    @Select("""
        <script>
        SELECT * FROM ci_change_record
        WHERE tenant_id = #{tenantId}
          AND (CASE action WHEN 'relate' THEN 'ci_instance_rel' ELSE 'ci_instance' END) IN
          <foreach collection='targetTypes' item='t' open='(' separator=',' close=')'>
            #{t}
          </foreach>
          <if test='instanceId != null'>AND instance_id = #{instanceId}</if>
          <if test='action != null'>AND action = #{action}</if>
          <if test='operatorId != null'>AND operator_id = #{operatorId}</if>
          <if test='modelId != null'>AND model_code = #{modelId}</if>
          <if test='fromDate != null'>AND created_at &gt;= #{fromDate}::timestamp</if>
          <if test='toDate != null'>AND created_at &lt; #{toDate}::timestamp</if>
        ORDER BY created_at DESC
        </script>
        """)
    Page<CiChangeRecord> queryChanges(Page<CiChangeRecord> page,
                                      @Param("tenantId")   String tenantId,
                                      @Param("targetTypes") List<String> targetTypes,
                                      @Param("instanceId") Long instanceId,
                                      @Param("action")     String action,
                                      @Param("operatorId") Long operatorId,
                                      @Param("modelId")    String modelId,
                                      @Param("fromDate")   String fromDate,
                                      @Param("toDate")     String toDate);

    /**
     * Daily action counts grouped by date + action for the stats panel.
     * Restricted to instance actions (create/update/delete).
     */
    @Select("""
        <script>
        SELECT DATE(created_at) AS dt, action, COUNT(*) AS cnt
        FROM ci_change_record
        WHERE tenant_id = #{tenantId}
          AND action IN ('create','update','delete')
          AND created_at &gt;= #{fromDate}::timestamp
          AND created_at &lt; #{toDate}::timestamp
          <if test='modelId != null'>AND model_code = #{modelId}</if>
        GROUP BY DATE(created_at), action
        ORDER BY dt
        </script>
        """)
    List<Map<String, Object>> queryDailyBreakdown(@Param("tenantId") String tenantId,
                                                  @Param("fromDate") String fromDate,
                                                  @Param("toDate")   String toDate,
                                                  @Param("modelId")  String modelId);

    /**
     * Top 10 most-changed instances (by change count) for the stats panel.
     */
    @Select("""
        <script>
        SELECT instance_id, COUNT(*) AS cnt
        FROM ci_change_record
        WHERE tenant_id = #{tenantId}
          AND action IN ('create','update','delete')
          AND created_at &gt;= #{fromDate}::timestamp
          <if test='modelId != null'>AND model_code = #{modelId}</if>
        GROUP BY instance_id
        ORDER BY cnt DESC
        LIMIT 10
        </script>
        """)
    List<Map<String, Object>> queryTopChangedInstances(@Param("tenantId") String tenantId,
                                                       @Param("fromDate") String fromDate,
                                                       @Param("modelId")  String modelId);
}
