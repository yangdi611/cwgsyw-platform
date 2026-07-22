package com.cwgsyw.platform.module.sharedfile.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonSetter;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateFolderRequest {
    @Size(max = 255, message = "文件夹名称不能超过255个字符")
    private String name;

    @JsonAlias("parent_id")
    private Long parentId;
    private boolean parentIdSpecified;

    @JsonSetter("parentId")
    @JsonAlias("parent_id")
    public void setParentId(Long parentId) {
        this.parentId = parentId;
        this.parentIdSpecified = true;
    }
}
