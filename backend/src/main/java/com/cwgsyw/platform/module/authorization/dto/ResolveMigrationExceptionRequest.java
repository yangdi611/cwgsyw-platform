package com.cwgsyw.platform.module.authorization.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ResolveMigrationExceptionRequest {
    @NotBlank
    @Pattern(regexp = "resolved|acceptedLegacy")
    private String status;

    @NotBlank
    @Size(min = 5, max = 500)
    private String note;
}
