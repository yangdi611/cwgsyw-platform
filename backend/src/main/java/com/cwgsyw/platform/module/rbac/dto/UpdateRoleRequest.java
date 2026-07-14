package com.cwgsyw.platform.module.rbac.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class UpdateRoleRequest {
    @NotBlank
    @Size(max = 64)
    private String name;

    @Size(max = 255)
    private String description;

    private List<Long> permissionIds;
}
