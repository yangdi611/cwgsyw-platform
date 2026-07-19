package com.cwgsyw.platform.module.config.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SmtpConfigRequest {
    private Boolean enabled;
    @Size(max = 253)
    @Pattern(
        regexp = "^$|^(?:\\[(?:[0-9A-Fa-f:]+)])|(?=.{1,253}$)(?!.*\\.\\.)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(?:\\.(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?))*$",
        message = "SMTP 主机名格式不正确"
    )
    private String host;
    @Min(1)
    @Max(65535)
    private Integer port;
    @Size(max = 128)
    private String username;
    @Size(max = 512)
    private String password;
    @Email
    @Size(max = 254)
    private String from;
    @Size(max = 128)
    private String fromName;
    private Boolean ssl;
}
