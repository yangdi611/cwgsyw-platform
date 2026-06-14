package com.cwgsyw.platform.module.cmdb.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDate;
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

    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> fieldsData;

    // ── 生命周期 & 资产管理字段 ──
    private String lifecycleStatus;
    private String lifecycleStage;
    private String assetCategory;
    private LocalDate purchaseDate;
    private BigDecimal purchasePrice;
    private String vendor;
    private LocalDate warrantyStart;
    private LocalDate warrantyEnd;
    private String contractNo;
}
