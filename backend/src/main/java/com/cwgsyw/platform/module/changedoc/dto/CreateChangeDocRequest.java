package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;

@Data
public class CreateChangeDocRequest {
    private String title;
    private String changeNo;       // optional override; auto-generated if blank
    private String changeDesc;
    private String impactScope;
    private String changeWindow;
    private String resourceSupport;
}
