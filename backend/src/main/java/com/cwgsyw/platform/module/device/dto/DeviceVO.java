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
    private Long ciInstanceId;
    private String ciInstanceName;
    /** CMDB 模型分组 code/name（由关联 CI 的 modelId 派生；CI 已删或无分组时为 null）。用于设备库按 CMDB 分组筛选。 */
    private String modelGroupCode;
    private String modelGroupName;
    private List<CredentialVO> credentials;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
