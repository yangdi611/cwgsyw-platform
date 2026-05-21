package com.cwgsyw.platform.module.rbac.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName("sys_resource")
public class SysResource {
    private Long id;
    private String code;
    private String name;
    private List<String> actions;
    private Integer sortOrder;
    private LocalDateTime createdAt;
}
