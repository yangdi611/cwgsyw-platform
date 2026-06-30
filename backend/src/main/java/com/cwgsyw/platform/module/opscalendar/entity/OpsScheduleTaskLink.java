package com.cwgsyw.platform.module.opscalendar.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("ops_schedule_task_link")
public class OpsScheduleTaskLink {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId = "default";
    private Long taskId;
    private String linkType; // daily_report, ci_instance, prometheus_alert, change_doc, file, external
    private Long linkId;
    private String linkTitle;
    private String linkUrl;
    private LocalDateTime createdAt;
    private Long createdBy;
}
