package com.cwgsyw.platform.module.workflow.dto;

import lombok.Data;

@Data
public class SaveProcessDefinitionReq {
    private String name;
    private String key;
    private String description;
    private String category;
    private String xml;
}
