package com.cwgsyw.platform.module.device.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateCredentialRequest {
    @NotBlank @Size(max = 128, message = "用户名不能超过128个字符") private String username;
    @NotBlank @Size(max = 1024, message = "密码不能超过1024个字符") private String password;
    @Size(max = 255, message = "备注不能超过255个字符") private String description;
    @JsonAlias("group_id") private Long groupId;   // which org-group owns this credential
}
