package com.cwgsyw.platform.module.authorization.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class BreakGlassActivationRequest {
    @NotBlank
    @Size(min = 10, max = 500)
    private String reason;
}
