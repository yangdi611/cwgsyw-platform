package com.cwgsyw.platform.module.device.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class CredentialVO {
    private Long id;
    private Long deviceId;
    private Long groupId;
    private String groupName;
    private String username;
    private String password;       // null when masked, plaintext when revealed
    private String description;
    private LocalDateTime createdAt;
}
