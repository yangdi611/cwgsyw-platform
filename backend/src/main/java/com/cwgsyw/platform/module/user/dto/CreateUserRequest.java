package com.cwgsyw.platform.module.user.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.*;
import lombok.Data;
import java.util.List;

@Data
public class CreateUserRequest {
    @NotBlank private String username;
    @NotBlank @Size(min = 6) private String password;
    @JsonAlias("real_name") private String realName;
    private String email;
    @JsonAlias("group_id")  private Long groupId;
    @JsonAlias("role_ids")  private List<Long> roleIds;
}
