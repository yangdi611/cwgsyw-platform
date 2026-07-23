package com.cwgsyw.platform.module.task.plan.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.task.plan.entity.TaskPlan;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 任务计划 Mapper
 */
@Mapper
public interface TaskPlanMapper extends BaseMapper<TaskPlan> {
    @Select("SELECT * FROM task_plan WHERE status = 'active' AND is_deleted = FALSE AND next_generate_at <= #{now} ORDER BY next_generate_at, id LIMIT #{limit}")
    List<TaskPlan> findDuePlans(@Param("now") LocalDateTime now, @Param("limit") int limit);
}
