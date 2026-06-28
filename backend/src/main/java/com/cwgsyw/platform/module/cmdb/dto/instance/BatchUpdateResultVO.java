package com.cwgsyw.platform.module.cmdb.dto.instance;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * 批量编辑结果（spec §9.1）。逐条独立处理，单条失败不阻断其余，汇总成功/失败。
 */
@Data
public class BatchUpdateResultVO {
    private int total;
    private int succeeded;
    private int failed;
    private List<FailItem> failures = new ArrayList<>();

    @Data
    public static class FailItem {
        private Long id;
        private String error;

        public FailItem(Long id, String error) {
            this.id = id;
            this.error = error;
        }
    }
}
