package com.cwgsyw.platform.module.cmdb.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("ci_attribute_group")
public class CiAttributeGroup {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String modelId;
    private String groupId;
    private String name;
    private Boolean isDefault;
    private Boolean isBuiltIn;
    private Integer sortOrder;
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime createdAt;
}
