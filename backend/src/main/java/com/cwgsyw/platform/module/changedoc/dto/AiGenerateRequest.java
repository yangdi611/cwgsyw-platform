package com.cwgsyw.platform.module.changedoc.dto;
import lombok.Data;

@Data
public class AiGenerateRequest {
    private String changeDesc;
    private String impactScope;
    private String changeWindow;
}
