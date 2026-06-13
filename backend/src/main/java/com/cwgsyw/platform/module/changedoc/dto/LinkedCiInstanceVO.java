package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * VO for a CI instance linked to a change document.
 * Combines instance metadata with the link's impact level and timestamp.
 */
@Data
public class LinkedCiInstanceVO {
    private Long id;
    private String name;
    private String modelId;
    private String modelName;
    private String owner;
    private String status;
    private String impactLevel;
    private LocalDateTime linkCreatedAt;
}
