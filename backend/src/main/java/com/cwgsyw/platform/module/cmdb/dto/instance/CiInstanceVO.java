package com.cwgsyw.platform.module.cmdb.dto.instance;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CiInstanceVO {
    private Long id;
    private String name;
    private String modelId;
    private String modelName;
    private String status;
    private String owner;
    private String description;
    private Map<String, Object> fieldsData;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

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
