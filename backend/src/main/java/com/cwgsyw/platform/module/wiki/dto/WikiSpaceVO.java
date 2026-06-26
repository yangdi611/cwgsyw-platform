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
    /** true=系统手册空间（seed 维护），前端据此决定置顶分层 */
    private boolean readOnly;
    /** true=seedKey != null，前端据此放在「官方手册」层 */
    private boolean system;
    /** 写权限范围：null=用户空间 / none / super_admin_only / all */
    private String writeScope;
}
