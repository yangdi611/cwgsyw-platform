package com.cwgsyw.platform.module.workflow.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

@Data
public class DeleteVersionRequest {
    @JsonAlias("definition_id")
    private String definitionId;
}
