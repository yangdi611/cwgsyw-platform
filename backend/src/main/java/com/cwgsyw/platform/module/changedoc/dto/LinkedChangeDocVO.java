package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * VO for a change document linked to a CI instance.
 * Combines change document summary with the link's impact level and timestamp.
 */
@Data
public class LinkedChangeDocVO {
    private Long id;
    private String changeNo;
    private String title;
    private String status;
    private Long applicantId;
    private String applicantName;
    private String impactLevel;
    private LocalDateTime linkCreatedAt;
}
