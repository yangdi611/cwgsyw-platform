package com.cwgsyw.platform.module.workflow.dto;

import lombok.Data;
import java.util.Map;

@Data
public class StartProcessRequest {
    private String processDefinitionKey;
    private String businessKey;
    private Map<String, Object> variables;
}
