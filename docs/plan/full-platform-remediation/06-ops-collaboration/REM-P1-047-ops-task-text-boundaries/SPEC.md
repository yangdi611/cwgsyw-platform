# REM-P1-047 实施合同

## 目标与不变量

关闭 `L4-OPS-004-001`：运维任务标题在数据库写入前遵循与 `VARCHAR(255)` 一致的稳定输入合同。

- 创建标题必填且不能仅为空白；更新显式提供标题时同样不能仅为空白。
- 标题按 Unicode code point 计数，最多 255 个字符；256 个及以上稳定返回 HTTP 400。
- 255 字符标题在创建、更新、读取和 UI 中保持原值，不截断。
- 无效标题不得触发任务、参与人、清单、日志、审计、通知或组引用写入。
- `content` 保持现有 PostgreSQL `TEXT` 合同；没有批准的最大值，不新增限制。
- 保持权限、租户、状态机、路由、响应成功合同、查询键和数据库 schema 不变。

## 实施范围

- `OpsCalendarTaskService.createManual`、`update`：共用标题校验。
- `TaskFormDialog`：显示 Unicode 字符计数并在提交前拒绝超长标题。
- `OpsCalendarTaskServiceTest`：创建/更新 255/256、空白与零副作用。
- L4 `OPS-004` Playwright 资产：事件 L3 与合并后同 run 复验。

## GitNexus 影响

- `createManual`：MEDIUM，7 个直接调用/测试，限 OpsCalendar；无跨模块流程。
- `update`：LOW，直接调用者为 `OpsCalendarTaskController.update`。
- `TaskCreateRequest`：LOW，8 个测试/模块引用；`TaskUpdateRequest`：LOW，无图谱上游扩散。
- `TaskFormDialog`：LOW，直接调用者为 `OpsCalendarInner`，影响 1 条 UI 流程。

## 验收条件

| AC | 条件 |
|---|---|
| `AC-001` | 创建标题 255 字符成功且原值持久化；256 字符 HTTP 400。 |
| `AC-002` | 更新标题 255 字符成功；空白和 256 字符 HTTP 400。 |
| `AC-003` | 无效输入不产生任务/参与人/清单/日志/审计/通知或组锁写副作用。 |
| `AC-004` | UI 显示准确 Unicode 字符计数，空白或超过 255 时不发送 POST。 |
| `AC-005` | L1-L3、当前分支容器、真实 API/UI、精确清理与 detect_changes 全部通过。 |
| `AC-006` | 同一 L4 run 的完整 `OPS-004` 复验 PASS，随后继续全部 NOT_RUN。 |

## 回滚与停止

回滚仅移除标题校验、UI 反馈和对应测试；无 schema 或数据迁移。若发现正文必须设置具体上限、需修改历史任务或出现不可精确清理对象，停止并请求产品语义/授权决定。
