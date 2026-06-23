package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;
import java.util.List;

@Data
public class AddCiLinkRequest {
    private List<Item> links;

    @Data
    public static class Item {
        private Long instanceId;
        private String impactLevel;
    }
}
