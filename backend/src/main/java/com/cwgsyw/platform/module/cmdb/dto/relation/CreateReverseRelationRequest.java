package com.cwgsyw.platform.module.cmdb.dto.relation;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Map;

/**
 * 反向建边请求（§5.5 P2）。路径上的实例为 dst（被关联方），此处提供 src 与 def。
 * 例：在 host 详情页选机柜 → srcInstanceId=机柜、defId=rack_contains_host。
 */
@Data
public class CreateReverseRelationRequest {

    /** 关联定义 def_id（如 rack_contains_host）。 */
    @NotNull
    @JsonAlias("def_id")
    private String defId;

    /** 关联发起方实例（如机柜实例 id）。 */
    @NotNull
    @JsonAlias("src_instance_id")
    private Long srcInstanceId;

    /** 可选关联属性（如 u_start/u_end）。 */
    private Map<String, Object> metadata;
}
