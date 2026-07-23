package com.cwgsyw.platform.module.opscalendar.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("ops_holiday_calendar")
public class OpsHolidayCalendar {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId = "default";
    private String name;
    private LocalDate startDate;
    private LocalDate endDate;
    private String holidayType = "legal"; // legal, company, campaign
    private String workdayOverrides = "[]"; // JSON array of dates
    private Boolean enabled = true;
    private String remark;
    @TableLogic
    private Boolean isDeleted = false;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private Long updatedBy;
}
