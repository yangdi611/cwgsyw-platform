package com.cwgsyw.platform.module.changedoc.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("change_doc_ci_link")
public class ChangeDocCiLink {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long changeDocId;
    private Long instanceId;
    private String impactLevel;
    private LocalDateTime createdAt;
    private Long createdBy;
    @TableLogic
    private Boolean isDeleted;
}
