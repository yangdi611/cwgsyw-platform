# REM-P2-012 实施合同

## 目标与不变量

关闭 `BUG-FQA-029`、`BUG-FQA-030`、`BUG-FQA-031`、`BUG-FQA-032`、`BUG-FQA-033`、`BUG-FQA-034`、`BUG-FQA-037`、`BUG-FQA-060` 的共同根因，交付“日期范围、月份与数值输入统一校验”。

- 保持既有成功路径、租户/范围隔离、权限和会话语义。
- 非法输入或状态必须稳定 4xx，失败不得半写入。
- 原证据只读；测试对象带 remediation runId 并经产品入口清理。
- 不用直接 SQL、流程表或对象存储操作伪造业务状态。

## 当前与目标

当前：反向日期在报表、任务、素材和排班端点被当作成功空集或 500，非法月份/日期类型与负工时也落入通用 500，统计页还永久 loading。

目标：调用方无法区分无数据和非法输入，用户看不到可恢复的字段错误。对应风险消失，API、服务、DTO、UI、审计和生命周期一致。

## 合同与预计影响

- 根因：日期解析、range 校验和 MethodArgumentTypeMismatchException 映射分散在多模块，前端 query error 分支不完整。
- 候选文件 / 符号：`backend/src/main/java/com/cwgsyw/platform/common/GlobalExceptionHandler.java`、`backend/src/main/java/com/cwgsyw/platform/module/report/**`、`backend/src/main/java/com/cwgsyw/platform/module/opscalendar/**`、`backend/src/main/java/com/cwgsyw/platform/module/daily/**`、`frontend/src/app/(dashboard)/ops-calendar/stats/page.tsx`
- 范围：建立共享日期/range/month 验证 helper；全局类型转换异常映射 400；日报工时范围校验；统计页错误态与 retry；保持各端点合法范围上限。
- 兼容：保留现有成功响应、路由、query key 和历史业务对象。
- GitNexus：规划索引已刷新；编辑每个符号前 upstream `impact`。

## 实施与验收

步骤：复现/确认 → 固定合同 → 最小改动 → L1/L2/L3 → `detect_changes` → 清理/回滚。

| AC | 条件 |
|---|---|
| `AC-001` | BUG-FQA-029 原始路径通过。 |
| `AC-002` | BUG-FQA-030、BUG-FQA-031、BUG-FQA-032、BUG-FQA-033、BUG-FQA-034、BUG-FQA-037、BUG-FQA-060 各有独立 PASS。 |
| `AC-003` | 正常、边界、deny/不存在、并发和失败零副作用通过。 |
| `AC-004` | 反向/同日/合法/超跨度；非法格式/非法月份；负/零/最大工时；所有端点 400 结构一致；UI loading/error/retry。 |
| `AC-005` | impact/detect、清理、审计与回滚记录完整。 |
| `AC-006` | L4 全量 FQA 通过；此前最多 `VERIFYING`。 |

## 停止与回滚

需要改非测试终态、全租户配置、不可逆流程历史，或出现未解释 5xx/影响超界时停止并 `BLOCKED`。回滚以独立提交为单位；schema/流程数据必须说明兼容恢复。
