package com.cwgsyw.platform.module.cmdb.dto.instance;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * 批量编辑请求（spec §9.1）。对 {@code ids} 中每个实例，把 {@code fields} 里的公共标量字段
 * 覆盖式合并进其 fieldsData（复用单条 update 的部分合并语义，每条独立审计/变更记录）。
 *
 * <p>{@code name/status/owner/description} 作为 ci_instance 顶层列，若在 fields 内出现同名键，
 * 由 Service 提升为顶层字段；其余键并入 fieldsData。table 字段不在批量编辑范围（仅标量公共字段）。
 */
@Data
public class BatchUpdateInstanceRequest {
    @NotEmpty(message = "ids 不能为空")
    private List<Long> ids;

    /** 要覆盖的公共字段（camelCase 不适用——这里是动态 field_key，原样作为 attrs 键）。 */
    @NotEmpty(message = "fields 不能为空")
    private Map<String, Object> fields;
}
