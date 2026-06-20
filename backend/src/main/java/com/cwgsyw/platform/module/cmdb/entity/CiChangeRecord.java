package com.cwgsyw.platform.module.cmdb.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * CMDB domain change record (Issue #64 AC6 / AD-6).
 *
 * <p>Decouples CMDB change history from the shared {@code audit_log} table.
 * {@code field_changes} stores a structured field-level diff
 * {@code [{"field":"x","before":...,"after":...}]} rather than coarse
 * before/after JSON snapshots. This entity intentionally does NOT extend
 * {@code BaseEntity} — {@code ci_change_record} is an append-only log without
 * soft-delete / updated-by columns.
 */
@Data
@TableName(value = "ci_change_record", autoResultMap = true)
public class CiChangeRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;

    private Long instanceId;

    private String modelCode;

    /** Canonical action: {@code create | update | delete | relate}. */
    private String action;

    /** Structured field-level diff: {@code [{field, before, after}]}. */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<Map<String, Object>> fieldChanges;

    private Long operatorId;

    private LocalDateTime createdAt;
}
