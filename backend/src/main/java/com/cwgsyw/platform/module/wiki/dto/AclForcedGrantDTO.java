package com.cwgsyw.platform.module.wiki.dto;

import lombok.Data;

import java.util.List;

/**
 * 表示一个 subject（role/group/user）在某个空间/页面里"即使不勾选也天然生效"的权限，
 * 或"当前从上级页面继承而来、勾选框预填"的权限——供前端渲染灰显锁定 / 继承提示两种视觉状态。
 * reason 供前端 tooltip 展示原因，取值：admin_scope / role_permission / creator / space_acl / ancestor_page。
 */
@Data
public class AclForcedGrantDTO {
    private String subjectType;
    private Long subjectId;
    private String subjectName;
    private List<String> permissions;
    private String reason;
}
