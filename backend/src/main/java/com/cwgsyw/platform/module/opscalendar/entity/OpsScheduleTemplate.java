package com.cwgsyw.platform.module.opscalendar.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("ops_schedule_template")
public class OpsScheduleTemplate extends BaseEntity {
    private String name;
    private String templateType; // notification, checklist, mixed
    private String taskType;
    private String titleTemplate;
    private String bodyTemplate;
    private String checklistJson;
    private Boolean enabled = true;
    private Boolean isBuiltin = false;
}
