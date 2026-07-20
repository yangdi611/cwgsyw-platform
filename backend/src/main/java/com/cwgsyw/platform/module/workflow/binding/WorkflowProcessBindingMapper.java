package com.cwgsyw.platform.module.workflow.binding;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface WorkflowProcessBindingMapper extends BaseMapper<WorkflowProcessBinding> {
    @Select("""
        SELECT COUNT(*)
        FROM workflow_process_binding
        WHERE tenant_id = #{tenantId}
          AND business_type = #{businessType}
        """)
    long countIncludingDeleted(@Param("tenantId") String tenantId,
                               @Param("businessType") String businessType);
}
