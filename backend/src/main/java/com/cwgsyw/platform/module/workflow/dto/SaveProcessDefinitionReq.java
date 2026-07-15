package com.cwgsyw.platform.module.workflow.dto;

import lombok.Data;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

@Data
public class SaveProcessDefinitionReq {
    @NotBlank(message = "流程名称不能为空")
    private String name;
    @NotBlank(message = "流程 Key 不能为空")
    @Pattern(regexp = "[A-Za-z][A-Za-z0-9_-]{0,127}", message = "流程 Key 只能包含字母、数字、下划线或连字符，且必须以字母开头")
    private String key;
    private String description;
    private String category;
    @NotBlank(message = "BPMN XML 不能为空")
    private String xml;
}
