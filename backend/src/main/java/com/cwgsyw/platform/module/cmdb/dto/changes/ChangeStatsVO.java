package com.cwgsyw.platform.module.cmdb.dto.changes;

import lombok.Data;

import java.util.List;

@Data
public class ChangeStatsVO {
    private ActionCountVO today;
    private ActionCountVO thisWeek;
    private ActionCountVO thisMonth;
    private List<DailyCountVO> dailyBreakdown;
    private List<TopInstanceVO> top10Instances;
}
