package com.cwgsyw.platform.module.wiki.dto;

import lombok.Data;

import java.util.List;

@Data
public class WikiSpaceAclDTO {
    private Long spaceId;
    private List<SpaceAclEntryDTO> entries;
    /** 该角色因 admin scope 或原生 wiki:&lt;action&gt; 权限，无论此处是否勾选都天然生效——仅计算，不入库。 */
    private List<AclForcedGrantDTO> forcedEntries;
}
