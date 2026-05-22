package com.cwgsyw.platform.module.config.dto;

import lombok.Data;

@Data
public class SmtpConfigRequest {
    private Boolean enabled;
    private String host;
    private Integer port;
    private String username;
    private String password;
    private String from;
    private String fromName;
    private Boolean ssl;
}
