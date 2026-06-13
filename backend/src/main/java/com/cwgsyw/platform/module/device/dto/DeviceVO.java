package com.cwgsyw.platform.module.device.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class DeviceVO {
    private Long id;
    private Long groupId;
    private String groupName;
    private String name;
    private String ip;
    private String deviceType;
    private String category;
    private String description;
    private List<CredentialVO> credentials;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
