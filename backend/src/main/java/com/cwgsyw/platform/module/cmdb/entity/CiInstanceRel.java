package com.cwgsyw.platform.module.cmdb.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.LinkedHashMap;
import java.util.Map;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName(value = "ci_instance_rel", autoResultMap = true)
public class CiInstanceRel extends BaseEntity {
    @TableField("src_id")
    private Long srcInstanceId;
    @TableField("dst_id")
    private Long dstInstanceId;

    /**
     * 引用的关联定义（ci_association_def.def_id）。
     *
     * <p>Java 字段名为 {@code defId}（AD-3 第 4 条）——历史命名 {@code associationKind}
     * 暗示存的是 kind 值，但底层列 {@code def_id} 承载的是 def 业务主键，二者语义不同，
     * 故收敛字段名消除歧义。{@code @TableField("def_id")} 不变。
     */
    @TableField("def_id")
    private String defId;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> metadata = new LinkedHashMap<>();
}
