package com.cwgsyw.platform.module.wiki.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

@Data
public class AclEntryDTO {
    @JsonProperty("subject_type") private String subjectType;
    @JsonProperty("subject_id")   private Long subjectId;
    @JsonProperty("subject_name") private String subjectName;
    private List<String> permissions;
}
