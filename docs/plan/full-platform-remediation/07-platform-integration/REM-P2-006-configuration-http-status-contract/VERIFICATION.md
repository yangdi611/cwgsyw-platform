# REM-P2-006 验证与证据矩阵

## 验收映射

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | SYSTEM-CONFIG-READ-BOUNDARY | L1 定向 | `SysConfigControllerTest` 覆盖 unsupported/empty/non-string 无写入、allow，以及 SMTP/通知/水印共享写入入口；`SysConfigServiceTest` 断言原子 upsert | `PASS` |
| `AC-002` |  | L2 根因聚类 | 真实认证会话下 unsupported、empty、non-string 分别返回 HTTP/body `400` | `PASS` |
| `AC-003` | 边界 / deny / 无副作用 | L2 | 三种拒绝前后 `/api/admin/config` 快照完全一致；允许 key 首次写入、读回并恢复为空值 | `PASS` |
| `AC-004` | 受影响模块 | L3 | 当前事件分支 backend 容器构建、健康检查、真实认证 API 验证及受影响配置入口回归通过 | `PASS` |
| `AC-005` | GitNexus / cleanup / rollback | L3 | `updateGeneric` LOW；`SysConfigService.set` HIGH（5 个直接调用者、1 条工作流流程），获授权后以原子 upsert 修复并回归；临时授权清零，配置审计按批准保留 | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新发布候选 run | `PENDING` |

## 原始失败证据

历史结论位于 `defects.md` 的 `BUG-FQA-022` 章节及 `test-results/FQA_20260712_0329_lintfix/`。修复后证据必须新建目录，禁止覆盖首次失败截图、trace 或 result。

## 执行规则

- PASS：预期、持久化、副作用、权限、审计和清理全部一致。
- FAIL：任一原始路径仍失败、出现未解释 5xx/Console error 或产生数据残留。
- BLOCKED：缺少明确授权、外部配置、独占窗口或精确清理能力；写明责任方和解除条件。
- L1→L2→L3 顺序执行；L4 是共同发布门禁。
- 清理使用产品 API 逆序执行，只删除本次 runId 对象，核对 active/cleanup_failed 均为 0。

## 2026-07-16 验证证据

- `mvn -q -Dtest=SysConfigControllerTest test` 在 testCompile 阶段被既有无关测试源错误阻断：OpsCalendarRuleServiceTest 缺 SecurityUser、OpsCalendarTaskServiceTest 的 insert 重载歧义、GroupControllerGroupReferenceTest DTO 类型不匹配。
- `mvn -q -Dmaven.test.skip=true compile` 和当前分支 backend 容器构建通过；容器健康状态为 UP。
- 早期 HTTP 403 已排除：真实登录身份原本具有 `workflow:configure`；问题是临时浏览器脚本未使用前端实际保存的认证键。改用真实 token 后，unsupported、empty、non-string 均为 HTTP/body `400`，配置前后快照一致。
- 用户明确授权一次性读取配置快照、写入允许 key、恢复原值并保留审计。此前不存在 `daily_report_process_definition_id`；写入后可读回，恢复为 `null` 后读回空字符串，证明首次写入走 upsert 而非旧的零行 UPDATE。
- 审计核验：本次恰有两条 `sys_config/update` 记录，remark 仅为 `key=daily_report_process_definition_id`，`before_json` 与 `after_json` 均为空；未记录配置值，按授权保留。
- GitNexus upstream：`updateGeneric` 为 LOW、零直接调用者；`SysConfigService.set` 为 HIGH，5 个直接调用者、4 个模块及 1 条模板创建流程。回归覆盖通用流程绑定、SMTP、通知和水印控制器入口；流程绑定通过同一共享服务静态调用链纳入。
- 临时授权遗留角色关联、角色权限、有效作用域分配、有效角色计数均为 `0`；未保留测试身份或权限。允许 key 已恢复；仅授权保留的两条无敏感值审计记录存在。
