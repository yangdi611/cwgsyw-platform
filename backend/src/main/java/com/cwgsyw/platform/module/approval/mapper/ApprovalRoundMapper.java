package com.cwgsyw.platform.module.approval.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.approval.entity.ApprovalRound;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 审批轮次 Mapper
 */
@Mapper
public interface ApprovalRoundMapper extends BaseMapper<ApprovalRound> {
    @Select("SELECT * FROM approval_round WHERE tenant_id = #{tenantId} AND id = #{id} FOR UPDATE")
    ApprovalRound lockById(@Param("tenantId") String tenantId, @Param("id") Long id);

    @Select("SELECT * FROM approval_round WHERE tenant_id = #{tenantId} AND process_instance_id = #{processInstanceId} FOR UPDATE")
    ApprovalRound lockByProcessInstanceId(@Param("tenantId") String tenantId,
                                          @Param("processInstanceId") String processInstanceId);
}
