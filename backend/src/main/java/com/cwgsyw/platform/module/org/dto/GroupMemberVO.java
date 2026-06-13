package com.cwgsyw.platform.module.org.dto;

import lombok.Data;
import java.util.List;

@Data
public class GroupMemberVO {
    private Long userId;
    private String username;
    private String realName;
    private String email;
    private List<String> roleNames;
}
