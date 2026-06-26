package com.cwgsyw.platform.module.wiki.dto;

import lombok.Data;

import java.util.List;

@Data
public class WikiAclDTO {
    private Long pageId;
    private boolean inherited;
    private List<AclEntryDTO> entries;
}
