package com.cwgsyw.platform.module.changedoc.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

import java.util.List;

@Data
public class LinkCiRequest {
    private List<LinkItem> links;

    @Data
    public static class LinkItem {
        @JsonAlias("instance_id")  private Long instanceId;
        @JsonAlias("impact_level") private String impactLevel;
    }
}
