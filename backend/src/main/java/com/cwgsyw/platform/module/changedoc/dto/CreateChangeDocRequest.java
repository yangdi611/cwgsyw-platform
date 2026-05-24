package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;
import java.util.Map;

@Data
public class CreateChangeDocRequest {
    private String changeNo;
    private Long applicationTemplateId;
    private Long planTemplateId;
    private Map<String, String> fieldsData;
}
