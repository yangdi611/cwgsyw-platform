package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;
import java.util.Map;

@Data
public class UpdateChangeDocRequest {
    private Map<String, String> fieldsData;
}
