package com.cwgsyw.platform.module.cmdb.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.Map;

@Data
@TableName(value = "ci_instance_rel", autoResultMap = true)
public class CiInstanceRel {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String defId;
    private Long srcId;
    private Long dstId;
    @TableField(typeHandler = com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler.class)
    private Map<String, Object> attrs;
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime deletedAt;
    private Long deletedBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long createdBy;
    private Long updatedBy;
}
