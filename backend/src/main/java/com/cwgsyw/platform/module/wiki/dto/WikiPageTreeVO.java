package com.cwgsyw.platform.module.wiki.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class WikiPageTreeVO {
    private Long id;
    private String title;
    private String slug;
    private String status;
    private Integer sortOrder;
    private Long spaceId;
    private List<WikiPageTreeVO> children = new ArrayList<>();
}
