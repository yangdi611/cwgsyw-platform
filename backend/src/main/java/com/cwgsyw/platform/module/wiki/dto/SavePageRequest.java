package com.cwgsyw.platform.module.wiki.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SavePageRequest {
    @NotBlank(message = "页面标题不能为空")
    @Size(max = 255, message = "页面标题不能超过 255 个字符")
    private String title;
    private String content;
    private String comment;
}
