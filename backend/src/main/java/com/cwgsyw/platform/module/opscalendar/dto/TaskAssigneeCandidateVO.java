package com.cwgsyw.platform.module.opscalendar.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class TaskAssigneeCandidateVO {
    private Long id;
    private String username;
    private String realName;
    private Long groupId;
}
