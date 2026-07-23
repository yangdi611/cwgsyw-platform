package com.cwgsyw.platform.module.opscalendar.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("ops_duty_roster")
public class OpsDutyRoster {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId = "default";
    private LocalDate dutyDate;
    private LocalDateTime startAt;
    private LocalDateTime endAt;
    private String shiftName = "全天";
    private Long assigneeId;
    private Long backupAssigneeId;
    private String phoneOverride;
    private Long groupId;
    private String remark;
    @TableLogic
    private Boolean isDeleted = false;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private Long updatedBy;
}
