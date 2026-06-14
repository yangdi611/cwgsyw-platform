package com.cwgsyw.platform.module.daily.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName(value = "daily_report", autoResultMap = true)
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

    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<Long> ciInstanceIds;
}
