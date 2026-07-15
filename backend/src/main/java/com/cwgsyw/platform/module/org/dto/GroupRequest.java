package com.cwgsyw.platform.module.org.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class GroupRequest {
    @NotBlank(message = "组名称不能为空")
    @Size(max = 64, message = "组名称不能超过64个字符")
    private String name;

    @Size(max = 255, message = "组描述不能超过255个字符")
    private String description;

    private Long leaderId;
}
