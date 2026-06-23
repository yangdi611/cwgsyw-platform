package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;

@Data
public class UpdateTemplateRequest {
    private String name;
    private String description;
    /** 取值：application | plan | general */
    private String docType;
}
