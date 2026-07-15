package com.cwgsyw.platform.module.sharedfile.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateSharedFileRequest {
    @NotBlank
    @Size(max = 255)
    private String name;
}
