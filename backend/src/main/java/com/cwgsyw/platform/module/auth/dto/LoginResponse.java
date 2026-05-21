package com.cwgsyw.platform.module.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import java.util.Set;

@Data
@AllArgsConstructor
public class LoginResponse {
    private String token;
    private String username;
    private String realName;
    private String groupScope;   // "group" | "tenant" | "platform"
    private Set<String> permissions;
}
