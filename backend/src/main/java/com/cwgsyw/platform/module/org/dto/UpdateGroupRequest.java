package com.cwgsyw.platform.module.org.dto;

import lombok.Data;

@Data
public class UpdateGroupRequest {
    private String name;
    private String description;
    private Long leaderId;
}
