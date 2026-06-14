package com.cwgsyw.platform.module.cmdb.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.Map;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName(value = "ci_instance", autoResultMap = true)
public class CiInstance extends BaseEntity {
    private String modelId;
    private String name;
    private String status;
    private String owner;
    private String description;

    @TableField(value = "attrs", typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> fieldsData;
}
