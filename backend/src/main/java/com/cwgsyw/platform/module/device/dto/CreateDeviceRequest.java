package com.cwgsyw.platform.module.device.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateDeviceRequest {
    // 必须关联一个 CMDB CI 实例；name/ip/deviceType 由 CI 派生，create 时无需传
    @NotNull(message = "必须关联 CMDB 实例")
    @JsonAlias("ci_instance_id")
    private Long ciInstanceId;

    private String name;        // 派生自 CI（兼容旧前端可传，但以 CI 为准）
    private String ip;          // 派生自 CI
    @JsonAlias("device_type") private String deviceType;  // 派生自 CI modelId
    private String category;    // 用户可补充的分类标签
    private String description; // 用户可补充的备注
    @JsonAlias("group_id")    private Long groupId;
}
