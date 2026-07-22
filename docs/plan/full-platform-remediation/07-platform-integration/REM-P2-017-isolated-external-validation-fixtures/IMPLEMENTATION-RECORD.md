# REM-P2-017 实施记录

## 2026-07-16：认领与实现

- L4 外部集成门禁发现：SMTP、Prometheus、AI 没有隔离、可观测且可恢复的开发验证夹具；AI 临时密钥也无显式清除合同。
- GitNexus upstream impact：`EmailService` 为 LOW（1 个直接依赖、12 个上游文件）；`PrometheusAlertSyncService` 为 LOW（0 个直接依赖）；`saveProvider` 为 LOW（0 个上游调用）；`saveProviderConfig` 为 LOW（仅 `saveProvider` 直接调用）。
- 开发 compose 增加内部网络上的 Mailpit 和固定响应 mock；生产 compose 未改。
- AI 仅新增受既有写权限保护的显式清钥端点；不会以空字符串改变既有保存语义。
- L1-L3 验证待当前分支容器重建后执行并回写。

## 2026-07-16：已完成的运行时检查与环境阻断

- `docker compose -f docker-compose.dev.yml config` 通过，显示 backend 同时连接 default 与内部 fixtures 网络；生产 compose 未改。
- `mvn -q -DskipTests compile`、当前分支 backend 镜像构建和 `/actuator/health=UP` 均通过。
- 真实 superadmin 会话下，`DELETE /api/admin/ai/providers/deepseek/api-key` 返回 200；读回 `configured=false`，baseUrl、model、enabled、systemPrompt 不变；匿名 DELETE 返回 403。首次尝试写入 NULL 被表的 NOT NULL 约束拒绝（409），已改为该表既有默认空值语义并复验通过。
- Mailpit / MockServer 公共镜像拉取曾被 Docker Desktop 非交互钥匙串阻断；镜像在交互环境缓存后，继续完成全部夹具复验。

## 2026-07-16：L1-L3 完成与恢复

- 内部 fixtures 网络验证：backend 容器成功访问 `external-api-mock` 的 `GET /api/v1/alerts` 固定空告警及 `POST /chat/completions` 固定回复，并读取 Mailpit 空收件箱；未经过互联网或代理。
- 初次 SMTP 复验暴露 `EmailService` 无条件 `mail.smtp.auth=true`，Mailpit 无认证连接被拒绝。GitNexus 对 `buildSender` upstream impact 为 CRITICAL：1 个直接调用者、13 个上游符号，间接覆盖日报、Wiki、工作流和运维通知；用户明确批准最小修复。
- `buildSender` 现在仅在 SMTP 用户名非空时启用认证。新增 `EmailServiceTest` 覆盖空用户名关闭认证、配置用户名保留认证；Maven 定向测试仍被 4 个既有无关 testCompile 错误阻断。
- 当前分支 backend 重建健康后，创建带 runId 的最小测试用户及日报，通过实际日报提交触发本地 Mailpit 邮件。Mailpit 记录确认 runId 收件地址、发件人和 `日报待审批` 主题；关联通知由既有 remediation purge 同时清理。日报 purge、用户删除、SMTP 恢复均返回 200；读取日报/用户均为 400 不存在。
- Prometheus 临时指向内部 mock，经过一个 10 秒调度周期，无同步错误且告警总数保持 0；配置恢复原值。
- AI 临时指向内部 mock，save/test/clear/restore 均为 200；test 返回 `isolated mock reply`，clear 后 `configured=false` 且其余字段不变，最终 provider 读回原始字段。
- 事件 L1-L3 结论为 PASS；无 runId 用户、日报、告警或临时配置残留。
