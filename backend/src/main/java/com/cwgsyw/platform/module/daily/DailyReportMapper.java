package com.cwgsyw.platform.module.daily;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.daily.entity.DailyReport;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import java.time.LocalDate;
import java.util.Optional;

@Mapper
public interface DailyReportMapper extends BaseMapper<DailyReport> {
    @Select("SELECT * FROM daily_report WHERE reporter_id = #{reporterId} AND report_date = #{date} AND is_deleted = false")
    Optional<DailyReport> findByReporterAndDate(Long reporterId, LocalDate date);
}
