package com.cwgsyw.platform.module.cmdb.dto.model;

import com.cwgsyw.platform.module.cmdb.dto.attribute.CiAttributeVO;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class CiModelVO {
    private Long id;
    private String name;
    private String displayName;
    private String group;
    private String groupName;
    private Boolean isBuiltIn;
    private String color;
    private Boolean enable2dView;
    private Integer instanceCount;
    private List<CiAttributeVO> attributes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
