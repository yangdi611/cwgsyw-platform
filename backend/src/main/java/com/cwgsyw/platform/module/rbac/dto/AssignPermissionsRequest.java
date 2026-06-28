package com.cwgsyw.platform.module.rbac.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;
import java.util.List;

@Data
public class AssignPermissionsRequest {
    @JsonAlias("permission_ids") private List<Long> permissionIds;
}
