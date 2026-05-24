package com.cwgsyw.platform.module.changedoc.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.util.Map;

@Data
public class CreateChangeDocRequest {
    @NotNull(message = "请选择变更文档模板")
    private Long templateId;

    private String changeNo;

    private Map<String, String> fieldsData;
}
