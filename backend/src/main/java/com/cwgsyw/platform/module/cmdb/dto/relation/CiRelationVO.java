package com.cwgsyw.platform.module.cmdb.dto.relation;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CiRelationVO {
    private Long id;
    private Long srcInstanceId;
    private String srcInstanceName;
    private Long dstInstanceId;
    private String dstInstanceName;
    private String associationKind;
    private LocalDateTime createdAt;
}
