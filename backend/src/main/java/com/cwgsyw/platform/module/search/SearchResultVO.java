package com.cwgsyw.platform.module.search;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 统一全局搜索结果项。所有类型（CI、共享文件、变更单、设备、用户、知识库）
 * 归一到同一结构，供前端命令面板（⌘K）按 {@code groupLabel} 分组展示。
 *
 * <p>Jackson 全局 SNAKE_CASE：{@code groupLabel} → {@code group_label}。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SearchResultVO {
    /** 结果类型代码：ci | shared_file | change_doc | device | user | wiki */
    private String type;
    /** 该类型下的主键（前端拼跳转 URL 用）。 */
    private Long id;
    /** 主标题（实例名/文件名/变更标题/设备名/用户名/页面标题）。 */
    private String title;
    /** 副标题：命中片段或辅助信息（如模型名、IP、变更单号），可为 null。 */
    private String subtitle;
    /** 前端路由 URL（已含 dashboard 子路径，不含 /api 前缀）。 */
    private String url;
    /** 分组标签（中文），前端按此聚合展示。 */
    private String groupLabel;
}
