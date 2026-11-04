package com.cwgsyw.platform.module.sosreport.dto;

import com.cwgsyw.platform.module.sosreport.parser.SosFactCatalog;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/** 映射规则接口的请求和响应。 */
public final class SosMappingDtos {

    private SosMappingDtos() {
    }

    /** 保存规则：status 为 confirmed 时必须给出事实和转换方式。 */
    @Data
    public static class SaveMappingRequest {
        private String status;
        private String factKey;
        private String transform;
        private Map<String, Object> transformArgs;
    }

    @Data
    public static class SuggestRequest {
        /** 只为这些字段生成；为空表示所有待映射字段。 */
        private List<String> fieldKeys;
    }

    @Data
    public static class FieldMappingVO {
        private String fieldKey;
        private String name;
        private String groupId;
        private String fieldType;
        private boolean required;
        private boolean unique;
        private boolean builtIn;
        private boolean supported;
        /** preset / confirmed / stale / suggested / unmappable / pending / manual_only */
        private String state;
        private String source;
        private String factKey;
        private String factLabel;
        private String transform;
        private Map<String, Object> transformArgs;
        private String aiVerdict;
        private BigDecimal aiConfidence;
        private String aiReason;
        private List<OptionVO> options;
    }

    @Data
    public static class OptionVO {
        private String id;
        private String name;

        public OptionVO(String id, String name) {
            this.id = id;
            this.name = name;
        }
    }

    @Data
    public static class MappingOverviewVO {
        private String modelCode;
        private int pendingCount;
        private boolean aiAvailable;
        private List<FieldMappingVO> fields;
    }

    @Data
    public static class TransformVO {
        private String code;
        private String label;

        public TransformVO(String code, String label) {
            this.code = code;
            this.label = label;
        }
    }

    @Data
    public static class FactCatalogVO {
        private List<SosFactCatalog.Fact> facts;
        private List<TransformVO> transforms;
    }

    @Data
    public static class RejectedSuggestionVO {
        private String fieldKey;
        private String reason;

        public RejectedSuggestionVO(String fieldKey, String reason) {
            this.fieldKey = fieldKey;
            this.reason = reason;
        }
    }

    @Data
    public static class SuggestResultVO {
        private int suggested;
        private int ambiguous;
        private int unmappable;
        private int remaining;
        private List<RejectedSuggestionVO> rejected;
    }
}
