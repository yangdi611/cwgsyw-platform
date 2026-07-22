package com.cwgsyw.platform.common;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.entity.AuditLog;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

@Mapper
public interface AuditLogMapper extends BaseMapper<AuditLog> {

    @Select("""
        SELECT * FROM audit_log
        WHERE tenant_id = #{tenantId}
          AND (#{module}::varchar IS NULL OR module = #{module}::varchar)
          AND (#{action}::varchar IS NULL OR action = #{action}::varchar)
          AND (#{operatorId}::bigint IS NULL OR operator_id = #{operatorId}::bigint)
          AND (#{keyword}::varchar IS NULL OR remark ILIKE CONCAT('%', #{keyword}::varchar, '%')
               OR target_type ILIKE CONCAT('%', #{keyword}::varchar, '%')
               OR CAST(target_id AS varchar) ILIKE CONCAT('%', #{keyword}::varchar, '%'))
          AND (#{startDate}::varchar IS NULL OR created_at >= #{startDate}::timestamp)
          AND (#{endDate}::varchar IS NULL OR created_at < (#{endDate}::date + INTERVAL '1 day')::timestamp)
        ORDER BY created_at DESC
        """)
    Page<AuditLog> queryPage(Page<AuditLog> page,
                              @Param("tenantId")   String tenantId,
                              @Param("module")     String module,
                              @Param("action")     String action,
                              @Param("operatorId") Long operatorId,
                              @Param("keyword")    String keyword,
                              @Param("startDate")  String startDate,
                              @Param("endDate")    String endDate);

    @Select("""
        SELECT * FROM audit_log
        WHERE tenant_id = #{tenantId}
          AND module = 'cmdb'
          AND target_type = 'ci_instance'
          AND target_id = #{instanceId}
        ORDER BY created_at DESC
        """)
    Page<AuditLog> queryInstanceHistoryPage(Page<AuditLog> page,
                                             @Param("tenantId") String tenantId,
                                             @Param("instanceId") Long instanceId);

    @Select("""
        <script>
        SELECT al.* FROM audit_log al
        WHERE al.tenant_id = #{tenantId}
          AND al.module = 'cmdb'
          <if test='targetTypes != null and !targetTypes.isEmpty()'>
            AND al.target_type IN
            <foreach collection='targetTypes' item='t' open='(' separator=',' close=')'>
              #{t}
            </foreach>
          </if>
          <if test='targetId != null'>AND al.target_id = #{targetId}</if>
          <if test='action != null'>AND al.action = #{action}</if>
          <if test='operatorId != null'>AND al.operator_id = #{operatorId}</if>
          <if test='fromDate != null'>AND al.created_at &gt; #{fromDate}::timestamp</if>
          <if test='toDate != null'>AND al.created_at &lt; #{toDate}::timestamp</if>
        ORDER BY al.created_at DESC
        </script>
        """)
    Page<AuditLog> queryChanges(Page<AuditLog> page,
                                @Param("tenantId")   String tenantId,
                                @Param("targetTypes") List<String> targetTypes,
                                @Param("targetId")   Long targetId,
                                @Param("action")     String action,
                                @Param("operatorId") Long operatorId,
                                @Param("fromDate")   String fromDate,
                                @Param("toDate")     String toDate);

    @Select("""
        <script>
        SELECT al.* FROM audit_log al
        WHERE al.tenant_id = #{tenantId}
          AND al.module = 'cmdb'
          <if test='targetTypes != null and !targetTypes.isEmpty()'>
            AND al.target_type IN
            <foreach collection='targetTypes' item='t' open='(' separator=',' close=')'>
              #{t}
            </foreach>
          </if>
          <if test='fromDate != null'>AND al.created_at &gt;= #{fromDate}::timestamp</if>
        ORDER BY al.created_at DESC
        </script>
        """)
    List<AuditLog> queryChangesList(@Param("tenantId")    String tenantId,
                                     @Param("targetTypes") List<String> targetTypes,
                                     @Param("fromDate")    String fromDate);

    @Select("""
        <script>
        SELECT DATE(created_at) AS dt, action, COUNT(*) AS cnt
        FROM audit_log
        WHERE module = 'cmdb' AND target_type = 'ci_instance'
          AND tenant_id = #{tenantId}
          AND created_at &gt;= #{fromDate}::timestamp
          AND created_at &lt; #{toDate}::timestamp
          <if test='modelId != null'>
            AND target_id IN (SELECT id FROM ci_instance WHERE model_id = #{modelId} AND tenant_id = #{tenantId})
          </if>
        GROUP BY DATE(created_at), action
        ORDER BY dt
        </script>
        """)
    List<Map<String, Object>> queryDailyBreakdown(@Param("tenantId") String tenantId,
                                                   @Param("fromDate") String fromDate,
                                                   @Param("toDate")   String toDate,
                                                   @Param("modelId")  String modelId);

    @Select("""
        <script>
        SELECT target_id, COUNT(*) AS cnt
        FROM audit_log
        WHERE module = 'cmdb' AND target_type = 'ci_instance'
          AND tenant_id = #{tenantId}
          AND created_at &gt;= #{fromDate}::timestamp
          <if test='modelId != null'>
            AND target_id IN (SELECT id FROM ci_instance WHERE model_id = #{modelId} AND tenant_id = #{tenantId})
          </if>
        GROUP BY target_id
        ORDER BY cnt DESC
        LIMIT 10
        </script>
        """)
    List<Map<String, Object>> queryTopChangedInstances(@Param("tenantId") String tenantId,
                                                        @Param("fromDate") String fromDate,
                                                        @Param("modelId")  String modelId);
}
