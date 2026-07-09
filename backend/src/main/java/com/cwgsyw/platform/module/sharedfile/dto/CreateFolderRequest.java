package com.cwgsyw.platform.module.sharedfile.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

@Data
public class CreateFolderRequest {
    private String name;
    @JsonAlias("parent_id")
    private Long parentId;
}
