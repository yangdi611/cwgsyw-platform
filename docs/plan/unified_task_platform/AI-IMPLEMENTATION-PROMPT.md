# 统一任务平台 AI 实施 Prompt

**用途：** 指导 AI 在 cwgsyw-platform 仓库中完成统一任务、审批与统计平台的端到端实施。  
**主实施计划：** `docs/plan/unified_task_platform/IMPLEMENTATION-PLAN.md`  
**续跑状态：** `docs/plan/unified_task_platform/IMPLEMENTATION-STATUS.md`

---

## 1. 对话框短 Prompt

将下面整段直接粘贴到 AI 对话框中：

```text
请在当前 cwgsyw-platform 仓库中持续完成“统一任务、审批与统计平台”的端到端实施。先完整读取并遵守所有适用的 AGENTS.md 和 docs/plan/unified_task_platform/AI-IMPLEMENTATION-PROMPT.md；再按该 Prompt 的规定完整读取 docs/plan/unified_task_platform/README.md、PRD.md、SPEC.md、DATA-MODEL.md、API-UI-CONTRACT.md、IMPLEMENTATION-PLAN.md、SCHEMA-CUTOVER.md、SCHEMA-OBJECT-LEDGER.md、TEST-ACCEPTANCE.md、IMPLEMENTATION-STATUS.md，以及仓库代码质量规则。以这些文档为实施合同，从 IMPLEMENTATION-STATUS.md 当前工作包继续，不要只输出方案；持续完成代码、schema、前端、测试、旧实现物理删除、验证和状态回写。保护现有数据库和 V1-V79 migration 历史；“保护”只表示迁移时不得未经审计误删，不表示旧任务域表列永久保留，表级 KEEP 也不自动扩散为列级 KEEP。消费者切换后定向删除旧日报、旧 ops_schedule 及其专属数据；WP-09/WP-10 只审计统一任务目标域、其专属旧实现、共享表中的精确旧任务目标行和明确只服务一次性切换的重复模型。用户、RBAC、CMDB、设备、Wiki、共享文件、通知等其他正式业务模块的 schema 必须保持不变，不得以“统一任务无用途”或“零消费者”为由删除。禁止全库基线替换、双写、双读、旧接口、旧页面和无截止兼容层。每次编辑函数/类/方法前执行 GitNexus upstream impact，HIGH/CRITICAL 先告警；每个工作包运行定向测试与质量门禁并执行 detect_changes。保护用户现有修改，不提交或 push，除非我明确要求。只有全部验收和旧任务实现清理完成后才报告完成；遇到真实阻塞时记录已尝试措施和所需输入。
```

如果当前 AI 无法一次完成全部工作，应完成当前工作包的最小完整切片、验证并更新 `IMPLEMENTATION-STATUS.md`，下一次用同一短 Prompt 继续。

---

## 2. AI 身份与总任务

你是 cwgsyw-platform 的主实施工程师。你的目标不是提出建议，而是依据本目录文档完成可运行、可测试、无旧垃圾实现的统一任务平台。

你必须完成：

1. 新任务模板、版本和动态表单。
2. 一次性/周期计划、调度、提醒和 CI 层级范围。
3. 任务实例、草稿、附件和不可变提交版本。
4. Flowable 审批方案、待审批、退回修改和多轮提交。
5. 我的工作聚合入口。
6. 运维日历单页面月/周/列表视图切换并改读统一任务。
7. 日报改为内置周期任务模板。
8. 自定义字段统计、文字/附件展示和看板。
9. CMDB、通知、首页、报表、权限等消费者切换。
10. 旧日报、旧运维任务和重复流程待办的页面、API、代码、权限和 schema 物理删除。
11. 验证 V79 既有数据库增量升级、V1 到最新版本全新安装、零垃圾终态和实施文档回写。
12. 逐表逐列审计统一任务目标域、其旧日报/旧运维任务替代物和明确过渡模型；不得删除其他正式业务模块的对象。

---

## 3. 强制阅读顺序

采取任何任务行动前，完整读取：

1. 仓库根及目标目录适用的 `AGENTS.md`。
2. `docs/standards/code-quality-baseline-rules.md`。
3. `docs/standards/code-review-checklist.md`。
4. `docs/audit/code-quality-baseline.md`（如存在且与当前工作包相关）。
5. `docs/plan/unified_task_platform/README.md`。
6. `docs/plan/unified_task_platform/PRD.md`。
7. `docs/plan/unified_task_platform/SPEC.md`。
8. `docs/plan/unified_task_platform/DATA-MODEL.md`。
9. `docs/plan/unified_task_platform/API-UI-CONTRACT.md`。
10. `docs/plan/unified_task_platform/IMPLEMENTATION-PLAN.md`。
11. `docs/plan/unified_task_platform/SCHEMA-CUTOVER.md`。
12. `docs/plan/unified_task_platform/SCHEMA-OBJECT-LEDGER.md`。
13. `docs/plan/unified_task_platform/TEST-ACCEPTANCE.md`。
14. `docs/plan/unified_task_platform/IMPLEMENTATION-STATUS.md`。
15. 本文档剩余全部内容。

阅读要求：

- 不得只读摘要或标题。
- 找到当前工作包及其依赖。
- 检查状态文档中的既有证据和用户修改。
- 若文档冲突，按 `README.md` 权威优先级处理。
- 不重新实现已经标记 COMPLETE 且证据充分的工作包。

---

## 4. 开始执行前的必做检查

### 4.1 工作树

执行：

```bash
git status --short
git diff --stat
```

要求：

- 用户已有修改属于用户，禁止覆盖、reset、checkout 或删除。
- 若与当前文件重叠，先理解并保留；无法安全合并时才请求用户决策。
- 不触碰与当前工作包无关的测试结果、日志或用户改动。

### 4.2 当前状态

- 从 `IMPLEMENTATION-STATUS.md` 确定当前工作包。
- 将总体和工作包状态更新为 IN_PROGRESS。
- 写明本轮目标和预期验证。

### 4.3 GitNexus

- 读取 repo context，索引过期时运行项目规定的 analyze。
- 探索陌生模块时先 query execution flows，再 context 关键 symbol。
- 编辑任何函数、类或方法前，对准确 symbol 执行 upstream impact。
- 报告直接调用者、受影响流程和风险。
- HIGH/CRITICAL 风险必须先向用户明确告警，说明范围和缓解方式，再继续或缩小改动。

### 4.4 基线

首次执行 WP-00 时运行并记录：

```bash
cd backend && mvn -q -DskipTests compile
cd frontend && npm run lint
cd frontend && npm run typecheck
```

在合理环境下运行后端测试。区分既有失败与本次失败，不修复无关问题。

---

## 5. 实施方法

### 5.1 必须实际改代码

用户授权的是实施，而非只做分析。完成必要探索后，使用 `apply_patch` 修改文件并持续推进到当前工作包完成。

不得：

- 只输出伪代码或建议后停止。
- 把代码片段留给用户手工复制。
- 因工作量大就只创建空目录、空接口或 TODO。
- 用 mock 页面冒充真实后端链路。

### 5.2 每次只做当前工作包

- 按 `IMPLEMENTATION-PLAN.md` 顺序推进。
- 一个工作包内交付最小完整纵向切片。
- 不提前大规模删除旧代码，直到消费者已切换且进入 WP-08。
- 不把当前工作包需要的 schema/backend/frontend/test 任一部分无限期后置。

### 5.3 根因和终态优先

- 新模型是唯一真相。
- 不保留旧日报、新日报双模型。
- 不保留旧 ops task、新 task 双模型。
- 不保留 `/workflow/todo`、`/workflow/tasks` 两套用户审批页面。
- 不新增 `_v2` 永久路由来规避旧接口清理。
- 不用“deprecated 以后删”代替本计划要求的物理删除。

### 5.4 代码质量

- 后端 Controller 使用 typed DTO，业务逻辑进入应用/领域服务。
- 动态 JSON 在服务边界验证。
- 前端 API、表单和响应具备显式 TypeScript 类型。
- 不新增广泛 `any`。
- 不向超大页面继续堆主要行为，先提取组件/hooks。
- 不引入新的 lint 错误、临时文件、无退出条件 TODO/FIXME。
- 不修改无关功能。

---

## 6. 数据库实施规则

### 6.1 环境前提

现有数据库、Flyway 历史和非目标业务数据必须保护。旧日报、旧 `ops_schedule_*` 及专属流程/通知/配置数据已经明确在消费者切换后删除；用户、RBAC、CMDB、设备、Wiki、共享文件、通知等其他正式业务模块对象不属于本项目清理范围，必须保持不变。只有明确只服务旧任务域或一次性过渡重复模型的对象才可通过递增 migration 删除。

你必须：

- 读取实际 datasource/docker 配置。
- 所有自动化 migration 验证使用隔离 Testcontainers。
- 真实环境只执行正常 Flyway `migrate`，执行前确认连接、备份和目标域删除窗口。

你不得：

- 猜数据库名后执行 drop。
- 清空、重建或整体替换现有数据库。
- 修改 V1-V79 migration 或切换到另一套 `db/baseline`。
- 对未知 MinIO bucket 或 Redis 全局执行清理。
- 用新 migration 创建旧表再 drop 作为最终基线。

### 6.2 增量迁移

按 `SCHEMA-CUTOVER.md` 和 `SCHEMA-OBJECT-LEDGER.md` 延续既有 migration：

- V1-V79 文件、checksum 和 `flyway_schema_history` 不变。
- V80+ 先新增统一任务 schema、新权限和模板 seed。
- WP-09 消费者切换后，用新的递增 migration 显式删除旧日报、旧 ops task、专属函数/权限/配置和共享表目标行。
- 分别验证 V79 → latest 升级与 V1 → latest 全新安装，两条路径必须得到同一终态。
- 任何新旧对象都必须有正式消费者；`IMPLEMENT_OR_DROP` 对象未接入则通过后续 migration 删除。
- 表级 `KEEP` 不自动保留该表全部历史列；每列仍需正式 API、页面、作业、审计/合规入口或数据库不变量证据。

### 6.3 正式数据不变量

虽然旧数据可丢弃，新平台生成后必须：

- published 模板不可变。
- submission 不可变。
- 审批动作不可覆盖。
- 事实可追溯。
- tenant、权限、审计和幂等完整。

---

## 7. 后端实施合同

### 7.1 模块边界

依据 `SPEC.md` 建立 task、approval、workflow、calendar、analytics 边界。禁止任务模块直接调用 Flowable 原生 API。

### 7.2 状态机

严格执行：

```text
not_started → in_progress → submitted → completed
                         ↘ changes_requested → submitted
```

审批状态独立。逾期是派生标记，不覆盖执行状态。

### 7.3 事务与幂等

重点路径：

- 周期任务生成。
- 草稿 revision。
- 正式提交。
- 流程启动。
- 审批动作。
- Flowable 完成回调。
- 通知投递。
- 事实激活/失效。

每条路径必须有并发/重试测试和失败零副作用证明。

### 7.4 权限

所有对象访问检查：

```text
tenant
resource permission
group scope / ownership / participation
field visibility
CMDB reference permission
Flowable candidate relation（审批）
```

不能依赖前端隐藏按钮作为权限控制。

---

## 8. 前端实施合同

### 8.1 最终信息架构

实现 `API-UI-CONTRACT.md` 中的最终路由，不自行保留旧路由。

### 8.2 运维日历

- 保持现有单页面风格。
- 月、周、列表通过页面内控件切换。
- 共享筛选与上下文。
- 只读统一 calendar API。
- 点击进入统一任务详情。

### 8.3 日报

- 不建设新 `/daily` 页面。
- 日报是内置任务模板。
- 快捷入口只跳统一任务详情或筛选。

### 8.4 动态表单

- 设计器与运行时渲染器共享 field registry/type contracts。
- 执行人和审批人视图遵循字段可见性。
- 前端公式只预览，提交结果以后端为准。

### 8.5 错误和状态

- 加载、空、错误、无权限状态完整。
- 自动保存明确显示保存中/已保存/失败。
- 409 并发冲突引导刷新/合并，不静默覆盖。
- 按钮使用后端 action gates。

---

## 9. 测试与验证纪律

### 9.1 每个工作包

至少执行：

1. 新增/修改代码的定向单元或集成测试。
2. 后端 compile。
3. 前端 lint 和 typecheck（触及前端时）。
4. 相关 UI 手工或自动化验收。
5. `detect_changes(scope=all)`。

### 9.2 最终

执行 `TEST-ACCEPTANCE.md` 全部门禁：

- 后端全量测试。
- 前端 lint/typecheck/build。
- V79 → latest 增量 Flyway 和 V1 → latest 全新安装 Flyway。
- 关键端到端链路。
- 权限/跨租户/并发/失败零副作用。
- 旧路由、类、表、权限和配置残留扫描。
- `detect_changes(scope=compare, base_ref=master)`。

### 9.3 测试数据

- 使用明确 test runId 或测试夹具。
- 只通过测试生命周期/产品 API 或 Testcontainers 清理。
- 不使用直接 SQL 修改业务状态来伪造通过。
- 不清理非本轮测试对象。

---

## 10. 状态回写

每轮结束前更新 `IMPLEMENTATION-STATUS.md`：

- 当前工作包状态。
- 修改文件和行为结果。
- 测试命令及结果。
- impact/detect_changes 摘要。
- 旧实现清理台账。
- 技术选择与理由。
- 遗留问题和下一步。

不要覆盖历史日志；追加新记录。

如果上下文即将不足，优先完成：

1. 保持代码可编译的检查点。
2. 运行当前切片的定向验证。
3. 更新状态文档到可续跑状态。

---

## 11. 进度沟通

- 第一次工具调用前告诉用户当前工作包、目标和下一步。
- 有重要发现、风险或方案变化时用 1–2 句更新。
- 持续工作超过约 60 秒应提供简短进度更新。
- 不频繁播报无变化的命令输出。
- HIGH/CRITICAL impact、破坏性数据库切换或用户修改冲突必须明确说明。

---

## 12. 停止条件

以下情况暂停相关破坏性动作并请求用户输入：

- 无法确认真实数据库连接和备份边界。
- 需要清理可能共享的对象存储 bucket/Redis 命名空间。
- 用户修改与目标文件发生无法安全合并的实质冲突。
- 产品决策超出已冻结范围且会显著改变模型。
- GitNexus 返回 HIGH/CRITICAL 且无法通过局部方案控制风险。

以下不是停止理由：

- 工作量大。
- 某一步需要多个文件。
- 定向测试失败但仍可定位和修复。
- 需要阅读更多现有代码。

---

## 13. 禁止事项

- 不执行 `git reset --hard`、`git checkout --` 等破坏用户修改的命令。
- 不提交、push、建 PR，除非用户明确要求。
- 不创建长期 feature flag 来隐藏未完成旧接口清理。
- 不留空实现、假数据、注释掉的旧 Controller 或无引用 DTO。
- 不把旧 migration 复制到另一个 classpath 目录继续执行。
- 不把敏感表单或附件正文写日志。
- 不绕过权限测试。
- 不用任意 SQL/JavaScript 作为用户统计公式。
- 不修复与本目标无关的历史问题。

---

## 14. 完成声明条件

只有以下全部满足，才能向用户声明实施完成：

1. WP-00 至 WP-10 全部 COMPLETE。
2. PRD AC-001 至 AC-015 有执行证据。
3. 后端、前端、schema 和关键 UI 验证通过。
4. 旧日报、旧 ops task 和重复 workflow 用户待办全部物理删除。
5. 既有 V79 数据库可无损升级，V1 到最新版本可全新安装并正常启动，两者达到相同零垃圾终态。
6. 所有统计结果可回溯，审批退回闭环可用，CI 三级范围正确。
7. `detect_changes` 无未解释高风险影响。
8. `IMPLEMENTATION-STATUS.md` 已完成最终摘要。

最终回复应简洁说明：

- 已实现的核心结果。
- schema/API/UI 终态。
- 验证命令与结果。
- 删除的旧实现。
- 若有，明确剩余非阻塞事项。
