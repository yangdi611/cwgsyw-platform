package com.cwgsyw.platform.module.sharedfile.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import java.util.List;

/** 单条 ACL 条目（请求与响应共用，响应额外带 subjectName） */
@Data
public class AclEntryDTO {
    @JsonProperty("subject_type") private String subjectType;       // 'role' | 'group' | 'user'
    @JsonProperty("subject_id")   private Long subjectId;
    @JsonProperty("subject_name") private String subjectName;       // 响应时回填，请求时可空
    private List<String> permissions; // ["read","write","update","delete"]
}
