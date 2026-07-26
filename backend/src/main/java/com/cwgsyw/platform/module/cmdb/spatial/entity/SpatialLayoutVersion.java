package com.cwgsyw.platform.module.cmdb.spatial.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDateTime;
import lombok.Data;

/** A mutable draft or an immutable published snapshot. */
@Data
@TableName(value = "ci_spatial_layout_version", autoResultMap = true)
public class SpatialLayoutVersion {
    @TableId
    private Long id;
    private String tenantId;
    private Long layoutId;
    private String state;
    private Integer versionNo;
    private Integer revision;
    private Integer schemaVersion;
    @TableField(value = "document_json", typeHandler = JacksonTypeHandler.class)
    private JsonNode document;
    private String documentChecksum;
    private Integer elementCount;
    private Long sourceVersionId;
    private String changeSummary;
    private LocalDateTime publishedAt;
    private Long publishedBy;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
    @TableField(fill = FieldFill.INSERT)
    private Long createdBy;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private Long updatedBy;
}
