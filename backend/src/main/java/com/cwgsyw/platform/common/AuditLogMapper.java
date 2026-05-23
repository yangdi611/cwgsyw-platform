package com.cwgsyw.platform.common;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.entity.AuditLog;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface AuditLogMapper extends BaseMapper<AuditLog> {

    @Select("""
        SELECT * FROM audit_log
        WHERE tenant_id = #{tenantId}
          AND (#{module}::varchar IS NULL OR module = #{module}::varchar)
          AND (#{operatorId}::bigint IS NULL OR operator_id = #{operatorId}::bigint)
          AND (#{startDate}::varchar IS NULL OR created_at >= #{startDate}::timestamp)
          AND (#{endDate}::varchar IS NULL OR created_at < (#{endDate}::date + INTERVAL '1 day')::timestamp)
        ORDER BY created_at DESC
        """)
    Page<AuditLog> queryPage(Page<AuditLog> page,
                              @Param("tenantId")   String tenantId,
                              @Param("module")     String module,
                              @Param("operatorId") Long operatorId,
                              @Param("startDate")  String startDate,
                              @Param("endDate")    String endDate);
}
