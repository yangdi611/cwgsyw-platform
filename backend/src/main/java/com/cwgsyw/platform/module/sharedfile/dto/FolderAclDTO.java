package com.cwgsyw.platform.module.sharedfile.dto;

import lombok.Data;
import java.util.List;

/** GET/PUT /folders/{id}/acl 的载体 */
@Data
public class FolderAclDTO {
    private Long folderId;
    private boolean inherited;        // true = 继承父文件夹
    private List<AclEntryDTO> entries;
}
