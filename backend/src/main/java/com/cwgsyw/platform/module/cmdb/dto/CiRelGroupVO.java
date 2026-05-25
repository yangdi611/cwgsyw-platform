package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;
import java.util.List;

@Data
public class CiRelGroupVO {
    private String kindId;
    private String kindName;
    private String srcToDst;
    private String dstToSrc;
    private List<CiInstanceRelVO> relations;
}
