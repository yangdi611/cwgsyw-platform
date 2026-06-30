package com.cwgsyw.platform.module.opscalendar.dto;

import lombok.Data;
import java.time.LocalDate;

@Data
public class HolidayVO {
    private Long id;
    private String name;
    private LocalDate startDate;
    private LocalDate endDate;
    private String holidayType;
    private String workdayOverrides;
    private Boolean enabled;
    private String remark;
}
