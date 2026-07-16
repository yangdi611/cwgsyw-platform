# REM-P2-016：Prometheus 配置保存 API 合同

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P2-016` |
| 优先级 | P2 |
| 领域 | `07-platform-integration` |
| 状态 | `VERIFIED` |
| 风险 | `MEDIUM` |
| 分支 | `codex/rem-p2-016-prometheus-config-api-contract` |
| 来源 | L4 `FQA_20260716_191500_lintfix` |

## 问题与影响

管理配置页面提供 Prometheus 保存入口，但后端没有 `PUT /api/admin/config/prometheus` mapping，真实管理员请求返回 HTTP 500，配置无法保存。

## 范围

- 新增 typed、受 `notification:manage` 保护的 Prometheus 配置写入 API。
- 保存 `prometheus.enabled`、`prometheus.url`、`prometheus.scrape_interval`。
- 保持既有成功响应、配置存储、调度器和前端 query key 不变。

非目标：不连接真实 Prometheus、不触发告警同步、不改动 SMTP/AI 配置、不扩大通用配置白名单。

## 当前结论

实现、当前分支容器运行时 API 复验和 GitNexus 变更审查均通过；等待独立提交与 `lint-fix` no-ff 合并后恢复 L4。

文件：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [实施记录](./IMPLEMENTATION-RECORD.md) / [执行 Prompt](./CLAUDE-CODE-PROMPT.md)
