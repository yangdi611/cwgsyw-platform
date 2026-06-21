package com.cwgsyw.platform.module.sharedfile.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class SharedFileVO {
    private Long id;
    private Long folderId;
    private String name;
    private String originalName;
    private String fileType;
    private Long sizeBytes;
    private String mdKey;
    private List<Long> visibleGroups;
    private String sourceType;
    private Long sourceId;
    private Long createdBy;
    private String createdByName;
    private LocalDateTime createdAt;
}
