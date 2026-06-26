package com.cwgsyw.platform.module.wiki.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("wiki_space")
public class WikiSpace {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String name;
    private String description;
    private Long createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long updatedBy;
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime deletedAt;
    private Long deletedBy;
    /** Seeder 标识：由 WikiManualSeeder 写入，用于幂等查找；用户手建空间为 null */
    private String seedKey;
    /** Seeder 内容 hash（预留，目前 space 级不用）*/
    private String seedHash;
}
