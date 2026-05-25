package com.cwgsyw.platform.module.cmdb.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.util.Map;

@Data
public class CreateRelRequest {
    @NotBlank  private String defId;
    @NotNull   private Long srcId;
    @NotNull   private Long dstId;
    private Map<String, Object> attrs;
}
