package com.cwgsyw.platform.module.sosreport.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName(value = "sos_cmdb_request", autoResultMap = true)
public class SosCmdbRequest extends BaseEntity {
    public static final String ACTION_CREATE = "create";
    public static final String ACTION_UPDATE = "update";

    public static final String STATUS_PENDING = "pending_approval";
    public static final String STATUS_APPLIED = "applied";
    public static final String STATUS_REJECTED = "rejected";
    public static final String STATUS_APPLY_FAILED = "apply_failed";

    private Long reportId;
    private String modelCode;
    private String action;
    private Long targetInstanceId;
    private String instanceName;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> proposedFields;

    /** 提交时的字段快照：名称、新旧值、来源，以及 AI 建议的置信度和理由。 */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<Map<String, Object>> fieldDetails;

    private String status;
    private Long resultInstanceId;
    private String failureMessage;
    private String processInstanceId;
    private Long submitterId;
    private Long decidedBy;
    private LocalDateTime decidedAt;
    private String decisionComment;
}
