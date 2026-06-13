package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;

import java.util.List;

@Data
public class LinkCiRequest {
    private List<LinkItem> links;

    @Data
    public static class LinkItem {
        private Long instanceId;
        private String impactLevel;
    }
}
