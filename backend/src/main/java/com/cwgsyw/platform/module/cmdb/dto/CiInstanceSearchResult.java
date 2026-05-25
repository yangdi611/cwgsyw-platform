package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class CiInstanceSearchResult {
    private List<CiInstanceSearchVO> records;
    private long total;
    private long page;
    private long size;
    private Map<String, Long> modelCounts;
}
