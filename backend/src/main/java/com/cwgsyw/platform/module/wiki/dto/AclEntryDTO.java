package com.cwgsyw.platform.module.wiki.dto;

import lombok.Data;

import java.util.List;

@Data
public class AclEntryDTO {
    private String subjectType;
    private Long subjectId;
    private String subjectName;
    private List<String> permissions;
}
