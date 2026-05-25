package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;
import java.util.Map;

@Data
public class SaveCiInstanceRequest {
    private Map<String, Object> attrs;
}
