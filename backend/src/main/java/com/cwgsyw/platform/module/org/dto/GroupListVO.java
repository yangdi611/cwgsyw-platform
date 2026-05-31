package com.cwgsyw.platform.module.org.dto;

import lombok.Data;
import java.util.List;

@Data
public class GroupListVO {
    private Long id;
    private String name;
    private String description;
    private Long leaderId;
    private String leaderRealName;
    private int memberCount;
    private List<String> memberPreview;
}
