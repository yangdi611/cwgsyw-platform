package com.cwgsyw.platform.module.rbac.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class CreateRoleRequest {
    @NotBlank
    @Size(max = 64)
    private String name;

    @NotBlank
    @Pattern(regexp = "[a-z][a-z0-9_]{2,63}")
    private String code;

    @Size(max = 255)
    private String description;

    private List<Long> permissionIds = List.of();
}
