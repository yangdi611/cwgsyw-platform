package com.cwgsyw.platform.module.cmdb.dto.instance;

import com.cwgsyw.platform.module.cmdb.dto.attribute.CiAttributeVO;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
public class CiInstanceDetailVO {
    private Long id;
    private String name;
    private String modelId;
    private String modelName;
    private String status;
    private String owner;
    private String description;
    private Map<String, Object> fieldsData;
    private List<CiAttributeVO> attributes;
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
