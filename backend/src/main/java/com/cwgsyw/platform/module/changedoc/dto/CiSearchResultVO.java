package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;
import java.util.List;

@Data
public class CiSearchResultVO {
    private List<CiRecord> records;
    private long total;

    @Data
    public static class CiRecord {
        private Long id;
        private String name;
        private String modelId;
        private String modelName;
    }
}
