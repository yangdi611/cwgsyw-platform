package com.cwgsyw.platform.module.wiki.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class GraphVO {
    private List<Node> nodes = new ArrayList<>();
    private List<Edge> edges = new ArrayList<>();

    @Data
    public static class Node {
        private Long id;
        private String title;
        private String status;
    }

    @Data
    public static class Edge {
        private Long source;
        private Long target;
    }
}
