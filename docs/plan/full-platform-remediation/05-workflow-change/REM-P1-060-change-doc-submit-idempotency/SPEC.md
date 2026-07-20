# REM-P1-060 实施合同

## 目标

保证同一租户变更文档的并发 submit 与 approve 只有一个请求完成状态转换、审计和快照；终端测试产生的归档文件必须可通过产品 API 精确清理。

## 范围

- `ChangeDocService.submit` 与 `approve` 在保留现有访问校验后，使用租户限定的数据库行锁重新读取文档并复核状态。
- `SharedFileService` 删除文件时，对明确不存在的 MinIO 对象删除数据库孤儿记录并写既有删除审计；其他存储失败仍阻止逻辑删除。
- Playwright 终端链保持现有状态、权限、导出和清理合同。

## 非目标

不改变审批状态语义、权限、模板引用规则、普通删除合同、MinIO restore、数据库卷、Redis、历史业务数据或任何全租户授权配置。

## 验收

| ID | 合同 |
|---|---|
| AC-001 | 两个并发 submit 恰好返回 `200/409`，状态和 submit 审计/快照唯一。 |
| AC-002 | 两个并发 approve 恰好返回 `200/409`，状态和 approve/archive 审计唯一。 |
| AC-003 | draft/pending/approved/re-draft/rejected 的导出内容和权限边界通过。 |
| AC-004 | 归档文件、文档、模板、角色和用户均通过产品 API 精确清理；manifest 零对象、零失败。 |

## GitNexus 影响

- `ChangeDocService.submit`：LOW，1 个直接 Controller 调用者，Changedoc 模块。
- `ChangeDocService.approve`：LOW，1 个直接 Controller 调用者，Changedoc 模块。
- 共享文件删除调用的 `copyOrThrow` 底层方法为 HIGH，涉及 Wiki/Changedoc/Sharedfile；因此未修改其全局语义，新增仅供 Sharedfile 清理使用的 `copyIfPresent`。

## 回滚

回滚本事件提交即可移除行锁和缺失对象孤儿元数据清理；无迁移、配置切换或历史数据改写。
