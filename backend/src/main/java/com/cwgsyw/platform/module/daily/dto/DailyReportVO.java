package com.cwgsyw.platform.module.daily.dto;

import com.cwgsyw.platform.module.cmdb.dto.CiInstanceBriefVO;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class DailyReportVO {
    private Long id;
    private Long groupId;
    private String groupName;
    private Long reporterId;
    private String reporterName;
    private LocalDate reportDate;
    private String completedItems;
    private String issues;
    private String tomorrowPlan;
    private BigDecimal workHours;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<Long> ciInstanceIds;
    private List<CiInstanceBriefVO> ciInstances;
}
