package com.cwgsyw.platform.module.changedoc.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("change_doc_template")
public class ChangeDocTemplate {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String name;
    private String description;
    private Integer version;
    private Boolean isActive;
    private String docxKey;
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long createdBy;
}
