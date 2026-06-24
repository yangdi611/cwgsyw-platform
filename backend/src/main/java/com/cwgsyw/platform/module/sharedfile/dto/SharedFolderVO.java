package com.cwgsyw.platform.module.sharedfile.dto;

import lombok.Data;
import java.util.List;

@Data
public class SharedFolderVO {
    private Long id;
    private String name;
    private Long parentId;
    /** true=自定义 ACL（界面显示锁标记）；false/缺省=继承父级 */
    private Boolean aclCustom;
    private List<SharedFolderVO> children;
}
