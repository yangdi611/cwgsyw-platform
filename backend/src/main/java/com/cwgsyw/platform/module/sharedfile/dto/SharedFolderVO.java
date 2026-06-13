package com.cwgsyw.platform.module.sharedfile.dto;

import lombok.Data;
import java.util.List;

@Data
public class SharedFolderVO {
    private Long id;
    private String name;
    private Long parentId;
    private List<SharedFolderVO> children;
}
