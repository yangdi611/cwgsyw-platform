package com.cwgsyw.platform.module.sosreport.entity;

import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName(value = "sos_field_mapping", autoResultMap = true)
public class SosFieldMapping extends BaseEntity {
    public static final String STATUS_SUGGESTED = "suggested";
    public static final String STATUS_CONFIRMED = "confirmed";
    public static final String STATUS_UNMAPPABLE = "unmappable";

    public static final String SOURCE_MANUAL = "manual";
    public static final String SOURCE_AI = "ai";

    private String modelCode;
    private String fieldKey;
    private String status;
    private String source;
    // 下面这些列需要能被改回 NULL（如已确认的规则改成“无法映射”），不能用默认的非空才更新策略。
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String factKey;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String transform;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> transformArgs;

    private String fieldFingerprint;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String aiVerdict;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private BigDecimal aiConfidence;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String aiReason;
    private Long confirmedBy;
    private LocalDateTime confirmedAt;
}
