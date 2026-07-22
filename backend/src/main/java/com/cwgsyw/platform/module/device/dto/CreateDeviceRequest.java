package com.cwgsyw.platform.module.device.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
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
    @Size(max = 64, message = "分类标签不能超过64个字符") private String category;
    @Size(max = 2000, message = "备注不能超过2000个字符") private String description;
    @JsonAlias("group_id")    private Long groupId;
}
