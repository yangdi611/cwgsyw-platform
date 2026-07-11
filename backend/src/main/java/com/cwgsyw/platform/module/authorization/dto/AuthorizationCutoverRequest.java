package com.cwgsyw.platform.module.authorization.dto;

import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class AuthorizationCutoverRequest {
    @Pattern(regexp = "ENFORCE|ROLLBACK", message = "confirmation must be ENFORCE or ROLLBACK")
    private String confirmation;
}
