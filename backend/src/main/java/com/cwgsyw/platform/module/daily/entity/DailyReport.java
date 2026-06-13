package com.cwgsyw.platform.module.daily.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("daily_report")
public class DailyReport extends BaseEntity {
    private Long groupId;
    private Long reporterId;
    private LocalDate reportDate;
    private String completedItems;
    private String issues;
    private String tomorrowPlan;
    private BigDecimal workHours;
    private String status;  // DRAFT / SUBMITTED / APPROVED / REJECTED
    private String processInstId;
}
