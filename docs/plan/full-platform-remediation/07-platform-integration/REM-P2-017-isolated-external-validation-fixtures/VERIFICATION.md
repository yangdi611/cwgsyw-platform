# REM-P2-017 验证矩阵

| AC | 层级 | 结果 | 证据 |
|---|---|---|---|
| AC-001 | L1/L3 | PASS | `docker compose config` 通过；Mailpit、MockServer 启动，backend 经内部 fixtures 网络访问固定 alerts/chat 响应 |
| AC-002 | L3 | PASS | SMTP 指向 Mailpit；日报提交触发本地捕获邮件；日报、关联通知、测试用户和 SMTP 配置均经产品 API 清理/恢复 |
| AC-003 | L3 | PASS | Prometheus 指向 mock 完成调度周期，无 sync error，告警数 `0 -> 0`，配置恢复原值 |
| AC-004 | L1/L3 | PASS | mock AI test 返回 `isolated mock reply`；清钥 200，读回 `configured=false` 且字段不变，provider 恢复原值 |
| AC-005 | L1-L3 | PASS | production compile、当前分支 backend build/health、匿名 DELETE 403 通过；定向 Maven test 被既有无关 testCompile 错误阻断 |

## 检查

- `mvn -q -DskipTests compile`：PASS。
- `mvn -q -Dtest=EmailServiceTest test`：被 4 个既有其他模块 testCompile 错误阻断（`OpsCalendarRuleServiceTest`、`OpsCalendarTaskServiceTest`、`GroupControllerGroupReferenceTest`）；本事件生产编译和容器构建均通过。
- 当前事件分支 backend 重建后 `/actuator/health=UP`。
- Mailpit 捕获本次日报通知至 runId 邮箱；Mailpit API 记录显示 subject `日报待审批`、from `fixture@example.test` 和对应 runId 收件地址。
- 临时 SMTP / Prometheus / AI 配置均通过原 API 恢复；日报和测试用户回读为稳定 400 不存在，告警数为 0。

测试账户与所有临时配置仅在运行时使用；不得写入文档或提交。L4 未执行范围继续按最终复验合同处理，不可标为 PASS。
