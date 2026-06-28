package com.cwgsyw.platform.module.user.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;
import java.util.List;

@Data
public class UpdateUserRequest {
    @JsonAlias("real_name") private String realName;
    private String email;
    private String password;
    @JsonAlias("group_id")  private Long groupId;
    private Integer status;
    @JsonAlias("role_ids")  private List<Long> roleIds;
}
