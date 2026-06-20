package com.cwgsyw.platform.module.cmdb.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 模型关联定义（ci_association_def）。
 *
 * <p>承载两个模型间允许建立的某种关联：方向（src→dst）、语义种类（kind_id，指向
 * {@code ci_association_kind}）、基数（mapping: 1:1 / 1:n / n:n）以及删除策略（on_delete）。
 * 业务主键为 {@code def_id}（UNIQUE(tenant_id, def_id)）。实例关联（ci_instance_rel.def_id）
 * 以本表 {@code def_id} 为外键依据（AD-3）。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("ci_association_def")
public class CiAssociationDef extends BaseEntity {
    /** 业务主键，实例关联据此引用本定义。 */
    @TableField("def_id")
    private String defId;

    /** 关联语义种类编码，指向 ci_association_kind.kind_id（纯语义字典，AD-3 第 5 条）。 */
    @TableField("kind_id")
    private String kindId;

    @TableField("src_model_id")
    private String srcModelId;

    @TableField("dst_model_id")
    private String dstModelId;

    private String name;

    /** 基数：1:1 | 1:n | n:n。 */
    private String mapping;

    /** 删除策略：none | cascade | restrict。 */
    @TableField("on_delete")
    private String onDelete;

    private Boolean isBuiltIn;
}
