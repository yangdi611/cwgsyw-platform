# REM-P2-016 实施合同

## 目标与不变量

为前端既有 `PUT /admin/config/prometheus` 调用提供稳定 API 合同，消除 HTTP 500。

- 权限继续为 `notification:manage`；匿名和无权限请求不得写入。
- 仅写三个既有 Prometheus key；不允许任意配置 key。
- URL 仅允许带主机名的 HTTP/HTTPS 地址，移除尾部 `/`；空字符串用于清空。
- `scrapeInterval` 最小 10 秒，与 `PrometheusAlertSyncService` 的下限一致。
- 不建立外部网络连接，也不触发同步；配置可通过同一 API 恢复。

## API

`PUT /api/admin/config/prometheus`

```json
{"enabled":false,"url":"http://127.0.0.1:9090/","scrapeInterval":60}
```

成功返回 HTTP/body `200`。格式错误或小于 10 秒返回 HTTP/body `400`；未认证返回 `403`。

## 影响与回滚

GitNexus upstream impact：`SysConfigController`、相邻 `updateSmtp` 均为 `LOW`，零直接调用者、零索引流程；管理配置页面是已知消费方。仅新增 Controller 方法和 DTO，复用已验证的 `SysConfigService.set` 原子 upsert。

回滚为回退本事件提交；不会涉及 schema、外部系统或数据卷。

## 验收条件

| AC | 条件 |
|---|---|
| AC-001 | 既有前端请求不再产生 500，保存与读回为 200。 |
| AC-002 | URL 规范化；无效 scheme/host 与小于 10 秒间隔为 400 且无写入。 |
| AC-003 | 匿名请求为 403。 |
| AC-004 | 当前事件分支 backend 容器运行时通过，配置恢复原值。 |
