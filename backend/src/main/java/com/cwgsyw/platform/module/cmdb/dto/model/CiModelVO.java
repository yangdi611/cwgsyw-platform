package com.cwgsyw.platform.module.cmdb.dto.model;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.cwgsyw.platform.module.cmdb.dto.association.CiAssociationDefVO;
import com.cwgsyw.platform.module.cmdb.dto.attribute.CiAttributeVO;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
@Data
public class CiModelVO {
    private Long id;
    private String modelId;
    private String name;
    private String displayName;
    private String group;
    private String groupName;
    private Boolean isBuiltIn;
    private String color;
    private Boolean enable2dView;
    private Integer instanceCount;
    private List<CiAttributeVO> attributes;
    private List<CiAttributeGroupVO> attributeGroups;
    /** 与本模型相关（作为 src 或 dst）的关联定义。仅在模型详情接口中填充。 */
    private List<CiAssociationDefVO> associationDefs;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /** Attribute group metadata for the new-instance form to render section headers. */
    @JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
    @Data
    public static class CiAttributeGroupVO {
        private Long id;
        private String groupId;   // group code (e.g. "base")
        private String name;       // display name (e.g. "基本信息")
        private Integer sortOrder;
    }
}
