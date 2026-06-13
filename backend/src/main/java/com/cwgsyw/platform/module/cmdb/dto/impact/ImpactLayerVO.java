package com.cwgsyw.platform.module.cmdb.dto.impact;

import lombok.Data;

import java.util.List;

@Data
public class ImpactLayerVO {
    private int depth;
    private List<ImpactNodeVO> nodes;
}
