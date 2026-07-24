package com.cwgsyw.platform.module.task.plan.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import com.cwgsyw.platform.module.task.plan.entity.TaskPlan;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 任务计划 Mapper
 */
@Mapper
public interface TaskPlanMapper extends BaseMapper<TaskPlan> {
    @Results(id = "taskPlanDueMap", value = {
        @Result(column = "schedule_config", property = "scheduleConfig", javaType = Map.class, typeHandler = JacksonTypeHandler.class),
        @Result(column = "assignment_rule", property = "assignmentRule", javaType = Map.class, typeHandler = JacksonTypeHandler.class),
        @Result(column = "ci_scope_config", property = "ciScopeConfig", javaType = Map.class, typeHandler = JacksonTypeHandler.class),
        @Result(column = "reminder_config", property = "reminderConfig", javaType = Map.class, typeHandler = JacksonTypeHandler.class),
        @Result(column = "escalation_config", property = "escalationConfig", javaType = Map.class, typeHandler = JacksonTypeHandler.class)
    })
    @Select("SELECT * FROM task_plan WHERE status = 'active' AND is_deleted = FALSE AND next_generate_at <= #{now} ORDER BY next_generate_at, id LIMIT #{limit}")
    List<TaskPlan> findDuePlans(@Param("now") LocalDateTime now, @Param("limit") int limit);
}
