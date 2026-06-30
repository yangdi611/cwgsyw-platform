package com.cwgsyw.platform.module.opscalendar.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("ops_schedule_checklist_item")
public class OpsScheduleChecklistItem {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId = "default";
    private Long taskId;
    private String title;
    private Boolean required = false;
    private String inputType = "checkbox"; // checkbox, text, number, select, attachment
    private String options;
    private String value;
    private Boolean checked = false;
    private Integer sortOrder = 0;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
