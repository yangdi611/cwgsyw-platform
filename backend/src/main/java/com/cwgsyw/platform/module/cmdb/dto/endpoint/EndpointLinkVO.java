package com.cwgsyw.platform.module.cmdb.dto.endpoint;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@Data
public class EndpointLinkVO {
    private Long id;
    private String linkType;
    private Long srcInstanceId;
    private String srcInstanceName;
    private String srcFieldKey;
    private String srcEndpointUid;
    private String srcEndpointLabel;
    private Long dstInstanceId;
    private String dstInstanceName;
    private String dstFieldKey;
    private String dstEndpointUid;
    private String dstEndpointLabel;
    private Map<String, Object> attrs;
    private LocalDateTime createdAt;
}
