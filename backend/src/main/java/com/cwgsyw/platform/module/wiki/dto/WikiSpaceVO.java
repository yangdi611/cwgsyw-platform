package com.cwgsyw.platform.module.wiki.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class WikiSpaceVO {
    private Long id;
    private String name;
    private String description;
    private long pageCount;
    private LocalDateTime updatedAt;
    private String createdByName;
    /** true=系统手册空间（seed 维护），前端据此隐藏新建/编辑/提交审批等写操作入口 */
    private boolean readOnly;
}
