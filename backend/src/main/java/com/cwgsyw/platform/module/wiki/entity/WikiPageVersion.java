package com.cwgsyw.platform.module.wiki.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("wiki_page_version")
public class WikiPageVersion {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long pageId;
    private Integer version;
    private String title;
    private String content;
    private String comment;
    private Long createdBy;
    private LocalDateTime createdAt;
}
