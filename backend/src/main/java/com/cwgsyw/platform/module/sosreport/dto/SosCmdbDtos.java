package com.cwgsyw.platform.module.sosreport.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** CMDB 入库预览和申请接口的请求和响应。 */
public final class SosCmdbDtos {

    private SosCmdbDtos() {
    }

    /** 预览和提交共用。overrides 是人工填写或修改的字段值。 */
    @Data
    public static class CmdbDraftRequest {
        private String instanceName;
        private Map<String, Object> overrides;
        private List<String> excludedFields;
    }

    @Data
    public static class PreviewFieldVO {
        private String fieldKey;
        private String name;
        private String groupId;
        private String fieldType;
        private boolean required;
        private boolean editable;
        private boolean unique;
        private boolean excluded;
        /** preset / confirmed / manual / none */
        private String origin;
        private String factKey;
        private String factLabel;
        private String transform;
        /** 映射规则的来源：manual 或 ai。ai 表示规则由 AI 建议、经人工确认。人工填写的字段没有这一项。 */
        private String ruleSource;
        private java.math.BigDecimal aiConfidence;
        private String aiReason;
        private Object value;
        private Object currentValue;
        private boolean changed;
        /** 这个字段为什么取不到值或不会被写入。 */
        private String problem;
        private List<SosMappingDtos.OptionVO> options;
    }

    @Data
    public static class CmdbPreviewVO {
        private String modelCode;
        /** create / update / conflict */
        private String action;
        private Long targetInstanceId;
        private String targetInstanceName;
        private String instanceName;
        private boolean workflowConfigured;
        private boolean canSubmit;
        private int pendingMappingCount;
        private List<String> blockingReasons = new ArrayList<>();
        private List<String> warnings = new ArrayList<>();
        private List<PreviewFieldVO> fields = new ArrayList<>();
    }

    @Data
    public static class DecisionRequest {
        private Boolean approved;
        private String comment;
    }

    /** 当前用户可以审批的入库申请，附带审批所需的全部内容。 */
    @Data
    public static class PendingApprovalVO {
        private Long requestId;
        private Long reportId;
        private String taskName;
        private String action;
        private Long targetInstanceId;
        private String instanceName;
        private String modelCode;
        private Map<String, Object> proposedFields;
        private List<Map<String, Object>> fieldDetails;
        private String submitterName;
        private LocalDateTime createdAt;
    }

    @Data
    public static class CmdbRequestVO {
        private Long id;
        private Long reportId;
        private String modelCode;
        private String action;
        private Long targetInstanceId;
        private String instanceName;
        private Map<String, Object> proposedFields;
        private List<Map<String, Object>> fieldDetails;
        private String status;
        private Long resultInstanceId;
        private String failureMessage;
        private String processInstanceId;
        private Long submitterId;
        private String submitterName;
        private Long decidedBy;
        private LocalDateTime decidedAt;
        private String decisionComment;
        private LocalDateTime createdAt;
    }
}
