package com.cwgsyw.platform.module.daily;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.daily.entity.DailyReport;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Mapper
public interface DailyReportMapper extends BaseMapper<DailyReport> {
    @Select("SELECT * FROM daily_report WHERE reporter_id = #{reporterId} AND report_date = #{date} AND is_deleted = false")
    Optional<DailyReport> findByReporterAndDate(Long reporterId, LocalDate date);

    @Select("SELECT * FROM daily_report WHERE ci_instance_ids @> CAST(CAST(#{instanceId} AS text) AS jsonb) AND is_deleted = false ORDER BY report_date DESC")
    List<DailyReport> findByCiInstanceId(@Param("instanceId") Long instanceId);
}
