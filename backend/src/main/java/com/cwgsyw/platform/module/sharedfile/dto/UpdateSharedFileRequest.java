package com.cwgsyw.platform.module.sharedfile.dto;

import jakarta.validation.constraints.Size;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonSetter;
import lombok.Data;

@Data
public class UpdateSharedFileRequest {
    @Size(max = 255)
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
