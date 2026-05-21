package com.cwgsyw.platform.common.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
@TableName("audit_log")
public class AuditLog {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String module;
    private String action;
    private Long targetId;
    private String targetType;
    private Long operatorId;
    private String operatorIp;
    private String beforeJson;
    private String afterJson;
    private String remark;
    private LocalDateTime createdAt;
}
