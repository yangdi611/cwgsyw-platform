package com.cwgsyw.platform.module.opscalendar.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.opscalendar.entity.OpsScheduleTask;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface OpsScheduleTaskMapper extends BaseMapper<OpsScheduleTask> {
    @Select("SELECT * FROM ops_schedule_task WHERE id = #{id} AND tenant_id = #{tenantId} FOR UPDATE")
    OpsScheduleTask selectByIdForUpdate(@Param("id") Long id, @Param("tenantId") String tenantId);
}
