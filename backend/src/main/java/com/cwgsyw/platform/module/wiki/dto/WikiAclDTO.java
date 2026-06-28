package com.cwgsyw.platform.module.wiki.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

@Data
public class WikiAclDTO {
    @JsonProperty("page_id") private Long pageId;
    private boolean inherited;
    private List<AclEntryDTO> entries;
}
