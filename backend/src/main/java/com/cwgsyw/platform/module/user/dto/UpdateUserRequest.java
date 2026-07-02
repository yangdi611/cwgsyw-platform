package com.cwgsyw.platform.module.user.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.Pattern;
import lombok.Data;
import java.util.List;

@Data
public class UpdateUserRequest {
    @JsonAlias("real_name") private String realName;
    private String email;
    // 手机号：国际化宽松格式（见 SPEC 12.1）
    @Pattern(regexp = "^$|^\\+?[0-9]{6,20}$", message = "手机号格式不正确")
    private String phone;
    /**
     * @deprecated 管理员改密统一走 POST /api/users/{id}/reset-password（SPEC 11.4）。
     * 保留字段仅为向后兼容旧调用；新前端不再发送。
     */
    @Deprecated
    private String password;
    @JsonAlias("group_id")  private Long groupId;
    private Integer status;
    @JsonAlias("role_ids")  private List<Long> roleIds;
}
