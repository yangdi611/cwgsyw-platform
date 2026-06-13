package com.cwgsyw.platform.module.cmdb.dto.instance;

import lombok.Data;

import java.util.List;

@Data
public class TwoDimensionViewVO {
    private String modelId;
    private String modelName;
    private String groupBy;
    private List<TwoDimGroupVO> groups;
    private List<GroupableAttrVO> groupableAttrs;
}
