package com.cwgsyw.platform.module.cmdb.dto.association;

import jakarta.validation.constraints.Pattern;
import lombok.Data;

/**
 * 更新模型关联定义。def_id（业务主键）和 src/dst/kind 不可变更，
 * 因为已有实例关联可能依赖它；要换关系结构请先删除再新建。
 */
@Data
public class UpdateAssociationDefRequest {
    private String name;

    @Pattern(regexp = "^(1:1|1:n|n:1|n:n)$", message = "mapping 必须为 1:1 / 1:n / n:1 / n:n")
    private String mapping;

    @Pattern(regexp = "^(none|cascade|restrict)$",
             message = "onDelete 必须为 none / cascade / restrict")
    private String onDelete;
}
