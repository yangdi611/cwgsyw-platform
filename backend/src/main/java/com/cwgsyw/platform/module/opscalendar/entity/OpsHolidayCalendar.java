package com.cwgsyw.platform.module.opscalendar.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDate;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("ops_holiday_calendar")
public class OpsHolidayCalendar extends BaseEntity {
    private String name;
    private LocalDate startDate;
    private LocalDate endDate;
    private String holidayType = "legal"; // legal, company, campaign
    private String workdayOverrides = "[]"; // JSON array of dates
    private Boolean enabled = true;
    private String remark;
}
