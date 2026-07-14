# REM-P1-030 实施合同

## 目标与不变量

关闭 `BUG-FQA-094` 的共同根因，交付“日报导出权限运行时消费者”。

- 保持既有成功路径、租户/范围隔离、权限和会话语义。
- 非法输入或状态必须稳定 4xx，失败不得半写入。
- 原证据只读；测试对象带 remediation runId 并经产品入口清理。
- 不用直接 SQL、流程表或对象存储操作伪造业务状态。

## 当前与目标

当前：daily_report:export 可分配，但日报 Controller 和页面没有导出 endpoint 或控件。

目标：用户获得无效果权限，授权矩阵与产品能力脱节。对应风险消失，API、服务、DTO、UI、审计和生命周期一致。

## 合同与预计影响

- 根因：permission registry/角色模板先于日报导出能力发布。
- 候选文件 / 符号：`backend/src/main/java/com/cwgsyw/platform/module/daily/**`、`frontend/src/app/(dashboard)/daily/**`、`backend/src/main/resources/db/migration/**`
- 范围：决定实现或下架 export action；若实现，提供日期范围下载 API/UI；应用数据范围、文件合同与审计；同步 permission consumer 分类。
- 兼容：保留现有成功响应、路由、query key 和历史业务对象。
- GitNexus：规划索引已刷新；编辑每个符号前 upstream `impact`。

## 实施与验收

步骤：复现/确认 → 固定合同 → 最小改动 → L1/L2/L3 → `detect_changes` → 清理/回滚。

| AC | 条件 |
|---|---|
| `AC-001` | BUG-FQA-094 原始路径通过。 |
| `AC-002` | 全部子路径 各有独立 PASS。 |
| `AC-003` | 正常、边界、deny/不存在、并发和失败零副作用通过。 |
| `AC-004` | export-only/read+export/read-only/no-permission；日期范围/空态；MIME/文件名/内容；跨组数据范围与审计。 |
| `AC-005` | impact/detect、清理、审计与回滚记录完整。 |
| `AC-006` | L4 全量 FQA 通过；此前最多 `VERIFYING`。 |

## 停止与回滚

需要改非测试终态、全租户配置、不可逆流程历史，或出现未解释 5xx/影响超界时停止并 `BLOCKED`。回滚以独立提交为单位；schema/流程数据必须说明兼容恢复。
