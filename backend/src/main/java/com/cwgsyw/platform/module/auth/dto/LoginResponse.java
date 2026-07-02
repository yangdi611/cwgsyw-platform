package com.cwgsyw.platform.module.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import java.util.List;
import java.util.Set;

@Data
@AllArgsConstructor
public class LoginResponse {
    private String token;
    private Long userId;
    private String username;
    private String realName;
    private String avatarUrl;
    private String groupScope;   // "group" | "tenant" | "platform"
    private Long groupId;
    private Set<String> permissions;
    /** CHANGE_PASSWORD / COMPLETE_PROFILE，非空时前端必须跳转 /account/setup（SPEC 8.2）。 */
    private List<String> requiredActions;
}
