package com.cwgsyw.platform.module.wiki.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

import java.util.List;

@Data
public class WikiAclDTO {
    @JsonAlias("page_id") private Long pageId;
    private boolean inherited;
    private List<AclEntryDTO> entries;
    /** 空间级已天然放行、页面级无法收回的权限——admin scope / 角色原生权限 / 空间创建人 / 显式空间 ACL，仅计算不入库。 */
    private List<AclForcedGrantDTO> forcedEntries;
    /** 当前页面处于继承状态时，从最近一层自定义了 ACL 的祖先页面解析出的有效权限——预填可编辑，并非强制。 */
    private List<AclEntryDTO> inheritedEntries;
}
