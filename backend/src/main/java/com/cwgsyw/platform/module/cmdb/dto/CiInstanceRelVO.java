package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.Map;

@Data
public class CiInstanceRelVO {
    private Long id;
    private String defId;
    private Boolean isSrc;           // true = current instance is src; JSON: is_src
    private Long peerId;
    private String peerName;
    private String peerModelId;
    private String peerModelName;
    private String directionLabel;
    private Map<String, Object> attrs;
    private LocalDateTime createdAt;
}
