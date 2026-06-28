package com.cwgsyw.platform.module.changedoc.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

@Data
public class UpdateTemplateRequest {
    private String name;
    private String description;
    /** 取值：application | plan | general */
    @JsonAlias("doc_type") private String docType;
}
