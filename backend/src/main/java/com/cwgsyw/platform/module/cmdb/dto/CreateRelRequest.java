package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;
import java.util.Map;

@Data
public class CreateRelRequest {
    private String defId;
    private Long srcId;
    private Long dstId;
    private Map<String, Object> attrs;
}
