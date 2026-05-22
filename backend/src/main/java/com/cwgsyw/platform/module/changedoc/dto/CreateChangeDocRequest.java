package com.cwgsyw.platform.module.changedoc.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateChangeDocRequest {
    @NotBlank(message = "变更标题不能为空")
    @Size(max = 255, message = "变更标题不能超过255个字符")
    private String title;

    private String changeNo;       // optional override; auto-generated if blank

    @NotBlank(message = "变更描述不能为空")
    private String changeDesc;

    @NotBlank(message = "影响范围不能为空")
    private String impactScope;

    @NotBlank(message = "变更时间窗口不能为空")
    private String changeWindow;

    private String resourceSupport;
}
