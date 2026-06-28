package com.cwgsyw.platform.module.device.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateCredentialRequest {
    @NotBlank private String username;
    @NotBlank private String password;
    private String description;
    @JsonAlias("group_id") private Long groupId;   // which org-group owns this credential
}
