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
    private String associationKind;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> metadata = new LinkedHashMap<>();
}
