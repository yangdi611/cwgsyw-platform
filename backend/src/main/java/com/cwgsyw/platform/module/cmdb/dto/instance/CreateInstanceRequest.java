package com.cwgsyw.platform.module.cmdb.dto.instance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

@Data
public class CreateInstanceRequest {
    @NotBlank
    private String modelId;

    @NotBlank
    private String name;

    private String status = "online";
    private String owner;
    private String description;

    @NotNull
    private Map<String, Object> fieldsData;

    // ── 生命周期 & 资产管理字段（可选）──
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
