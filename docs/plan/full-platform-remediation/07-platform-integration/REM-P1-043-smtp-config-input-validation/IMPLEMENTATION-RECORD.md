# REM-P1-043 实施记录

## 2026-07-19：认领

- 基线：`lint-fix@95e6fff6c34205f6444a8ad6ec8c0d5fbd0ffa39`；分支：`codex/rem-p1-043-smtp-config-input-validation`；runId：`REM_P1_043_20260719`。
- L4 首次失败：`host=bad host with spaces` 返回 200 并持久化；失败快照提交为 L4 分支 `c7e3c70a`。冻结的 SMTP 原值已通过产品 API 恢复，manifest 为空。
- GitNexus upstream impact：`SmtpConfigRequest` 1 个直接上游、0 个流程，LOW；`updateSmtp` 0 个直接上游、0 个流程，LOW。
- 范围：DTO Bean Validation、Controller `@Valid`、定向测试与当前分支运行时复验；不触及发送器、通知、秘密或真实外部系统。

## 2026-07-19：实现与 L1-L3

- `SmtpConfigRequest` 增加 host 长度/格式、port `1..65535`、from 邮件格式和用户名/密码/发件人名称长度约束；`updateSmtp` 启用 `@Valid`。Mailpit 单标签、DNS、IPv4 和方括号 IPv6 保持可用。
- L1：本机 DTO validation 与 production compile PASS；缓存的 Java 21 Maven 镜像中 DTO、Controller、EmailService 定向测试全部 PASS。本机 Java 26 的 Mockito/Byte Buddy 限制未作为事件失败。
- L2：当前分支真实 API 对空格 host、协议 host、路径 host、超长 host、端口 0/65536、非法 from 均返回 400；所有 SMTP 字段前后不变。
- L3：当前分支 backend 镜像构建成功，只替换 backend 并健康；frontend/PostgreSQL/Redis/MinIO/Nginx 容器 ID 未变化。真实配置页发出 400 并收到 `SMTP 主机名格式不正确`，无成功 toast 和未解释 Console error。
- 正向回归：指向内部 Mailpit 的合法配置保存、读回并通过真实日报提交捕获 8 封候选审批人邮件；随后优先恢复原 SMTP，再通过 remediation 产品 API 删除日报。
- 独立后快照：SMTP disabled、host/user/password/from 为空、port 465、from-name `IT运维平台`、SSL true；runId 日报 0，backend health UP，日志仅有预期邮件成功记录。
- 正式 `wiki_page -> remp1038wiki` 与 `superadmin` 审批策略未修改；未连接真实 SMTP、未记录秘密。
- 回滚：移除 DTO 约束和 Controller `@Valid`；无迁移或数据恢复。
