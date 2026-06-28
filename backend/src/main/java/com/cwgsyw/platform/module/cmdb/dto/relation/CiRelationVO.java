package com.cwgsyw.platform.module.cmdb.dto.relation;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@Data
public class CiRelationVO {
    private Long id;
    private Long srcInstanceId;
    private String srcInstanceName;
    private Long dstInstanceId;
    private String dstInstanceName;
    /** 关联定义 def_id（与 associationKind 同值，新代码用此键，语义更准）。 */
    private String defId;
    private String associationKind;
    private Map<String, Object> metadata;
    private LocalDateTime createdAt;
}
