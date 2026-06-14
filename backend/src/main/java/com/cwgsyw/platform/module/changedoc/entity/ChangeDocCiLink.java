package com.cwgsyw.platform.module.changedoc.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("change_doc_ci_link")
public class ChangeDocCiLink extends BaseEntity {
    private String tenantId;
    private Long changeDocId;
    private Long instanceId;
    private String impactLevel;
}
