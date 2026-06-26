package com.cwgsyw.platform.module.wiki.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("wiki_backlink")
public class WikiBacklink {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long fromPageId;
    private Long toPageId;
    private LocalDateTime createdAt;
}
