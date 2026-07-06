package com.cwgsyw.platform.module.wiki.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

import java.util.List;

@Data
public class AclEntryDTO {
    @JsonAlias("subject_type") private String subjectType;
    @JsonAlias("subject_id")   private Long subjectId;
    @JsonAlias("subject_name") private String subjectName;
    private List<String> permissions;
}
