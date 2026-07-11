package com.cwgsyw.platform.module.authorization.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class ConvertRoleAclRequest {
    @NotBlank(message = "请选择目标主体类型")
    @Pattern(regexp = "user|group", message = "角色 ACL 只能转换为指定用户或指定组")
    private String subjectType;

    @NotNull(message = "请选择目标用户或组")
    @Positive(message = "目标用户或组无效")
    private Long subjectId;

    @NotBlank(message = "请输入 CONVERT 确认")
    @Pattern(regexp = "CONVERT", message = "请输入 CONVERT 确认")
    private String confirmation;
}
