# REM-P0-001 验证与证据矩阵

## 1. 验证原则

- 本文验证修复事件，不覆盖或改写原测试报告。
- 每个结果只能是 `PASS / FAIL / BLOCKED / N/A`；P0 合同中的必测项不得标 N/A。
- 每个测试对象带新的 runId，创建后立即登记 manifest，按依赖逆序用产品接口清理。
- 权限拒绝同时检查 UI、直接路由、直接 API、数据库无变化和 reasonCode（若接口合同提供）。
- 原始失败证据与修复后证据使用不同目录，禁止覆盖。

建议修复 runId：`REM_P0_001_YYYYMMDD_HHMM_<branchShort>`。

## 2. 原始失败证据

| 项目 | 已确认事实 | 证据 |
|---|---|---|
| 夹具 | membership `55`、assignment `63`；仅 `wiki:read`，管理组 group scope | `test-results/FQA_20260712_0329_lintfix/RBAC-026-membership-removal/result.json` |
| 删除前 | `GET /api/wiki/spaces` 返回 200 | 同上 `statuses.beforeRemoval` |
| 删除 membership | 产品 API 返回 200，数据库 membership 软删除 | 同上 `statuses.removeMembership`；源运行数据库摘要 |
| 原 session | 删除后仍返回 200 和 6 个空间 | 同上 `statuses.originalAfter`、`originalAfterBody` |
| 新 session | 重新登录后仍返回 200 和 6 个空间 | 同上 `statuses.newAfter`、`newAfterBody` |
| 清理 | assignment 撤销、用户和角色删除均返回 200 | 同上 `statuses.revoke/deleteUser/deleteRole` |

原始失败路径只实际证明 Wiki 越权；共享文件是同一高风险授权链的修复后必补回归，不得误写为已有失败证据。

## 3. 来源用例追溯

| 来源 | 原合同 | 当前状态 | 本事件复查责任 |
|---|---|---|---|
| `BUG-FQA-017` | membership 删除后 group assignment 立即失效 | 核心修复 `PASS` | 事件级关闭仍受 groups `11..15` 清理阻塞 |
| `RBAC-026` | 原/新 session 重试 Wiki 与共享文件，任一放行即 FAIL | `PASS` | 最新运行时双资源、多 session 证据已补齐 |
| `XL-RBAC-002` | 主组、多组变化后旧组不越权 | `PASS` | 多组独立、移除与 rejoin 已验证 |
| `XL-RBAC-006` | permission、scope、ACL、ancestor 四层按首个失败层裁决 | `PASS` | 拒绝层级自动化 `13/13 PASS` |
| `XL-RBAC-009` | membership + group assignment → 移除 membership → 双资源、双会话拒绝 | `PASS` | 最新状态链通过；仅测试组清理门禁阻塞事件关闭 |

## 4. 验收映射

| 验收项 | 测试场景 | 测试层 | 预期证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | 同组活动 membership + group assignment 访问 Wiki/共享文件 | API + UI + DB | 两资源 allow、assignment/membership 有效快照 | `PASS` |
| `AC-002` | 删除 membership 后原 session 重试两资源 | API + UI + DB | 403、无数据、membership deleted、assignment 不参与裁决 | `PASS` |
| `AC-003` | 新登录与刷新 token session 重试两资源 | API + session + DB | 各自 403；无全局 session 清空 | `PASS` |
| `AC-004` | 查询 permissions、role IDs、highest scope、scoped assignment | 单元 + PostgreSQL 集成 | 四条路径均排除孤儿 group assignment | `PASS` |
| `AC-005` | 无 membership 但持有效 tenant assignment | API + DB | 合法 tenant 访问不受影响 | `PASS` |
| `AC-006` | future/expired assignment、多角色 union、多组 | 单元 + API + DB | 时间和并集合同保持 | `PASS` |
| `AC-007` | 无 permission、scope miss、expired、ACL deny、ancestor x deny | API + DB | 403、正确 reasonCode/层级、无写入 | `PASS` |
| `AC-008` | 删除主组、非主组、多组中的一个 membership | API + DB | 只失效目标组，其他组不变 | `PASS` |
| `AC-009` | 离组后重新入组 | API + DB | 旧 assignment 不自动恢复，需显式重新授权 | `PASS` |
| `AC-010` | membership 删除与 assignment 撤销/审计原子性 | 单元 + 集成 | 全成或全回滚；审计可追溯 | `PASS` |
| `AC-011` | ENFORCED/SHADOW/LEGACY | 单元 + 配置只读核验 | 各模式合同正确，mode/epoch 不变 | `PASS` |
| `AC-012` | 夹具逆序清理 | API + DB + Redis + MinIO | active objects/session/object=0，非测试状态一致 | `PASS` |
| `AC-013` | 稳定页面与 API 日志检查 | UI + network + console + backend log | 未解释 error/5xx/exception=0 | `PASS` |
| `AC-014` | 代码影响复核 | GitNexus | `detect_changes` 仅含预期符号/流程 | `PASS` |

最终结算为 `PASS=14 / BLOCKED=0 / FAIL=0 / N/A=0`。2026-07-14 经用户批准，`REM-P1-001` 使用产品 archive API 归档历史 groups `11..15`，随后仅复跑本事件 `AC-012`，10/10 清理与不变量检查全部通过。证据位于 `test-results/REM_P0_001_20260714_0254_lint_fix/REM-P0-001/ac-012-recheck/result.json`；其余 13 个 AC 复核既有 PASS 证据，未重跑，也未冒充发布级 `275+78`。

最终机器可读复验摘要为同证据目录的 `final-reverification.json`；并发清单为 `concurrency-regression.json`。证据里的登录 token 已全部脱敏，不作为通过条件或报告内容。

## 5. 详细场景矩阵

### 5.1 session × resource

| membership 状态 | assignment | session | Wiki | 共享文件 |
|---|---|---|---|---|
| active | active same-group | 删除前原 session | allow | allow |
| removed | assignment 仍留存但无效 | 原 session 下一请求 | 403 | 403 |
| removed | assignment 仍留存但无效 | 新登录 session | 403 | 403 |
| removed | assignment 仍留存但无效 | refresh 后 session | 403 | 403 |
| rejoined | 旧 assignment 不恢复 | 新 session | 403 | 403 |
| rejoined + 新显式 assignment | 新 assignment active | 新 session | allow | allow |

### 5.2 scope 与 membership

| 场景 | 预期 |
|---|---|
| 主组 membership 删除 | 目标组 assignment 失效；legacy primary group 同步按产品合同清除 |
| 非主组 membership 删除 | 仅目标组 assignment 失效；主组和其他组不变 |
| 多组 A/B，删除 A | A assignment 无效，B assignment 仍有效 |
| assignment scopeId 与 membership groupId 不同 | 不得用错误 membership 支撑 assignment |
| 跨 tenant 同 ID group | 不得匹配 |
| membership/assignment 任一逻辑删除 | group assignment 无效 |
| deleted group | assignment 无效 |
| tenant assignment | 不依赖 membership |

### 5.3 裁决层级

每行使用独立夹具，禁止用一个拒绝同时代表多层：

| 拒绝类型 | permission | assignment scope | resource ACL/mode | ancestor x | 预期 |
|---|---|---|---|---|---|
| 无功能权限 | 缺失 | N/A | N/A | N/A | 403，`FUNCTION_PERMISSION_DENIED`（若接口暴露） |
| membership 已移除 | 有角色但 group assignment 无效 | 不覆盖 | 满足 | 满足 | 403，不得命中该 assignment |
| assignment 过期 | assignment 不在有效期 | 不覆盖 | 满足 | 满足 | 403 |
| ACL 拒绝 | 满足 | 覆盖 | 拒绝 | 满足 | 403，`RESOURCE_ACCESS_DENIED` |
| 祖先 traverse 拒绝 | 满足 | 覆盖 | 子资源满足 | 拒绝 | 403，`ANCESTOR_TRAVERSE_DENIED` |

## 6. 分层复查节奏

### L1：定向复查——每次代码迭代

- mapper/service 单元与 PostgreSQL 集成测试；
- `RBAC-026`、`XL-RBAC-009`；
- Wiki/共享文件 × 原 session/新 session/refresh；
- tenant assignment unaffected；
- 清理闭环。

L1 任一 FAIL，停止扩大回归，先修复本事件。

### L2：根因聚类回归——L1 全 PASS 后

- `XL-RBAC-002` 主组/非主组/多组；
- `XL-RBAC-006` 四层裁决；
- assignment expiry、多角色 permission union；
- rejoin 不自动恢复；
- ENFORCED/SHADOW/LEGACY。

### L3：受影响模块回归——合并前

- 组织：membership 增删、primary group；
- RBAC：assignment CRUD、role reference、validUntil；
- Wiki：list/read/create/comment 与 ACL；
- 共享文件：list/upload/download 与 ACL；
- 登录/旧 session：permissions、highest scope、requiredActions 不回归；
- 运维日历组长查找（GitNexus 标记的间接消费者）。

### L4：发布关闭回归——发布候选版本

执行完整主功能 `275` + 状态/跨模块 `78` 的实时分母。L4 不是每次修复提交都重跑，但在版本关闭前不得省略；实时用例数漂移时以重新提取分母为准。

## 7. 证据目录

修复后证据建议保存为：

```text
test-results/<remediationRunId>/REM-P0-001/
├── environment.json
├── fixture-manifest.json
├── api-summary.json
├── db-before.json
├── db-after-membership-removal.json
├── session-matrix.json
├── reason-code-matrix.json
├── cleanup.json
├── console/
├── network/
├── logs/
├── screenshots/
└── trace/
```

文档只保存相对路径与摘要，不写密码、token 或敏感 header。

## 8. 关闭门禁

`REM-P0-001` 关闭必须同时满足：

1. `AC-001..014` 全部 PASS；
2. `RBAC-026`、`XL-RBAC-002/006/009` 全部从 FAIL 更新为 PASS，并保留新运行证据；
3. Wiki 和共享文件都覆盖原/new/refresh session；
4. tenant assignment、expiry、多角色、多组、rejoin 无回归；
5. `HIGH/CRITICAL` 影响链的 L3 模块回归完成；
6. runId 活动对象、session、MinIO objects 为 0；
7. authorization mode/epoch、superadmin、非测试 assignment/membership/ACL 前后相同；
8. 未解释 Console error、HTTP 5xx、后端异常为 0；
9. `IMPLEMENTATION-RECORD.md` 包含实际 diff、GitNexus `detect_changes`、验证与回滚结论；
10. 总索引状态更新为 `CLOSED`。
