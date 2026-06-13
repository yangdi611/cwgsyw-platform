package com.cwgsyw.platform.module.org.dto;

import lombok.Data;
import java.util.List;

@Data
public class CreateGroupRequest {
    private String name;
    private String description;
    private Long leaderId;
    private List<Long> memberIds;
}
