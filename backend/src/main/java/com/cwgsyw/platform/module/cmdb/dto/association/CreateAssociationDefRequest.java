package com.cwgsyw.platform.module.cmdb.dto.association;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class CreateAssociationDefRequest {
    @NotBlank
    @Pattern(regexp = "^[a-zA-Z][a-zA-Z0-9_]*$",
             message = "def_id 必须以字母开头，仅含字母/数字/下划线")
    private String defId;

    @NotBlank
    private String name;

    @NotBlank
    private String kindId;

    @NotBlank
    private String srcModelId;

    @NotBlank
    private String dstModelId;

    /** 基数：1:1 | 1:n | n:1 | n:n */
    @NotBlank
    @Pattern(regexp = "^(1:1|1:n|n:1|n:n)$", message = "mapping 必须为 1:1 / 1:n / n:1 / n:n")
    private String mapping;

    /** 删除策略：none | cascade | restrict */
    @Pattern(regexp = "^(none|cascade|restrict)$",
             message = "onDelete 必须为 none / cascade / restrict")
    private String onDelete;
}
