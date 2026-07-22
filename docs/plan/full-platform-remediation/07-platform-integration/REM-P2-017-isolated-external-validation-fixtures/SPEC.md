# REM-P2-017 实施合同

## 运行时边界

- 夹具仅位于 `docker-compose.dev.yml`：生产 compose 完全不变。
- `mailpit` 位于内部 `fixtures` 网络，backend 以 `mailpit:1025` 发送；Web UI 仅用于确认捕获。
- SMTP 用户名为空时，不发送 SMTP AUTH；用户名非空时保留认证。该行为使本地捕获器可用，不改变既有带凭据 SMTP 的认证路径。
- `external-api-mock` 位于同一内部网络，以固定本地响应处理 `GET /api/v1/alerts` 和 `POST /chat/completions`；无代理、无外网出口。
- backend 同时连接默认网络和 `fixtures`；其余业务服务不接入 fixtures 网络。

## API 合同

`DELETE /api/admin/ai/providers/{provider}/api-key`

- 需要 `ai_config:write`。
- 清空指定租户、既有 provider 的加密 API Key；baseUrl、model、enabled、systemPrompt 保持不变。
- 成功 HTTP/body `200`；provider 不存在沿用既有业务错误；未认证或无权限为 `403`。
- 空字符串 PUT 不能隐式清钥；清除必须使用本接口。

## 验收

| AC | 条件 |
|---|---|
| AC-001 | 开发 compose 可启动 Mailpit 与不出网的固定 HTTP mock。 |
| AC-002 | SMTP 指向 Mailpit 后可捕获平台发送的测试邮件，随后恢复原配置。 |
| AC-003 | Prometheus 指向 mock 后同步只处理固定本地响应，测试产生的数据可精确清理或无新增。 |
| AC-004 | AI 使用 mock 成功测试；显式清钥后 `configured=false`，其余 provider 字段不变。 |
| AC-005 | 当前分支编译、容器健康、权限拒绝与恢复检查通过。 |

## 回滚

回退本事件提交并通过产品 API 恢复被测配置快照。夹具不持久化业务数据，不改 schema。
