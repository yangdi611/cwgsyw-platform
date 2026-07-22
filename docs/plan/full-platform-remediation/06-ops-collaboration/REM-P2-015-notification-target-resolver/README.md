# REM-P2-015：通知目标只读解析端点

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P2-015` |
| 优先级 | P2 |
| 领域 | `06-ops-collaboration` |
| 状态 | `CLOSED` |
| 风险 | `MEDIUM` |
| 负责人 | Codex |
| 创建 / 更新 | 2026-07-16 |
| 来源 | 用户确认的 `REM-P2-011` 增补合同 |

## 问题与目标

`REM-P2-011` 的前端解析页逐类调用详情端点后跳转。用户已确认新增一个只读、权限感知的通知目标解析端点，以把“通知归属、目标类型、授权可达性和路由结果”收敛为服务端合同。

端点只接受当前用户自己的 notification ID；不得接受任意 refType/refId 作为对象查询入口，不得改变已读状态、通知投递或业务对象。

## 边界

- 范围：通知归属校验、已知引用类型、最小路由结果、无权/不存在中性不可用结果、前端消费。
- 非目标：不改通知投递、生产者、已读生命周期、权限模型、对象 ACL、路由定义或已有详情 API。
- GitNexus：`NotificationController` 为 LOW（0 direct caller）；共享 `NotificationService` 为 MEDIUM（9 direct callers），本事件避免修改其投递/读取既有方法，新增专用 resolver。

## 2026-07-16 L1-L3 结论

- `GET /api/notifications/{notificationId}/target` 只按当前会话的 notification ID 解析；先校验归属，再调用既有受保护详情读取，结果只保留 `available/href`。
- 有效 Wiki 通知从通知中心真实点击进入 `/wiki/8/54`；删除、失效和随机 ID 一律为 `available=false`，无目标详情泄露；未认证为 `403`。
- 通知 isRead 与总数保持不变；当前分支容器健康，Console error=0、目标端点 failed request=0。

下一门禁：提交事件证据并 `--no-ff` 合并到 `lint-fix`，然后从最新集成点重新开始最终 L4。

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
