package com.cwgsyw.platform.module.cmdb.dto.instance;

import lombok.Data;

import java.util.List;

@Data
public class TwoDimGroupVO {
    private String groupValue;
    private List<TwoDimCellVO> instances;
}
