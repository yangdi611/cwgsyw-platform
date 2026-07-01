package com.cwgsyw.platform.module.wiki.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("wiki_page_comment")
public class WikiPageComment {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long pageId;
    private String content;
    private Long createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime deletedAt;
    private Long deletedBy;
}
