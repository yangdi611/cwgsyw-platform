package com.cwgsyw.platform.module.cmdb.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("ci_model")
public class CiModel {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String modelId;
    private String name;
    private String icon;
    private String groupCode;
    private String description;
    private Boolean isBuiltIn;
    private Boolean isPaused;
    private Integer sortOrder;
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long createdBy;
}
