package com.cwgsyw.platform.module.device.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateCredentialRequest {
    @NotBlank private String username;
    @NotBlank private String password;
    private String description;
    private Long groupId;   // which org-group owns this credential
}
