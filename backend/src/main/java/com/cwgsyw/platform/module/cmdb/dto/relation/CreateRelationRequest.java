package com.cwgsyw.platform.module.cmdb.dto.relation;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Map;

/**
 * 创建实例关联请求（canonical DTO，见 Spec §3.4）。
 *
 * <p>canonical：{@code defId}（指向 ci_association_def.def_id）。旧字段 {@code associationKind}
 * 作为兼容 alias 保留一个版本：当 {@code defId} 缺失时由 service 按 AD-3 兼容策略推导。
 *
 * <p>显式声明 {@link JsonNaming}(LowerCamelCase) 以使 canonical camelCase 契约（Spec §3.4）
 * 与前端 AC1 后的 camelCase 调用对齐；{@link JsonAlias} 兼容 snake_case 写法。
 */
@Data
@JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
public class CreateRelationRequest {

    /** [canonical] 指向 ci_association_def.def_id。 */
    @JsonAlias("def_id")
    private String defId;

    /** [alias, deprecated] 裸 association kind code；defId 缺失时按 AD-3 推导。 */
    @Deprecated
    @JsonAlias("association_kind")
    private String associationKind;

    @NotNull
    @JsonAlias("dst_instance_id")
    private Long dstInstanceId;

    /** 按 ci_association_attr_def（经 def.kindId 关联）校验的关联属性。 */
    private Map<String, Object> metadata;
}
