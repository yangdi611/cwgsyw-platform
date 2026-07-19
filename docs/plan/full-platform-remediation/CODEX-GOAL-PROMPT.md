# Codex Goal：顺序完成全平台整改事件

本文是 Codex `/goal` 的长期执行合同。目标文本只负责引用本文；所有实施、验证、记录、分支、合并、恢复和停止条件均以本文为准。

## 如何启动

在 `/Users/byron/AI/cwgsyw-platform` 打开同一个 Codex 任务，确认当前仓库为本项目后输入：

```text
/goal 顺序完成 docs/plan/full-platform-remediation/CODEX-GOAL-PROMPT.md 定义的全部整改工作。完整读取该文件并将其作为硬约束与完成标准；从 REMEDIATION-CHECKPOINT.json 恢复，不重做已完成事件。每个事件必须使用独立分支，完成实现、L1-L3 复验、证据回写、提交并按顺序合并到 lint-fix 后才能进入下一事件。所有事件达到 VERIFIED 后执行独立的 L4 全平台复验；只有 L4 全部通过、无未解释 FAIL/BLOCKED、台账一致且工作区收敛，目标才算完成。遇到文件规定的高风险授权边界时暂停并请求用户决定。
```

Codex 的 Goal 文本有长度限制，因此不要把本文全文粘贴到 `/goal`；让 Goal 引用本文，并始终在同一个任务中继续。任务被中断后使用 `/goal resume`，然后从检查点恢复。

## 最终目标

以 `lint-fix` 为唯一集成分支，在一个本地工作区中顺序完成本事件库的所有未关闭整改：

1. 每个事件只在自己的独立分支中实施、验证和记录，不并行编辑，不创建额外 worktree。
2. 每个事件的代码、文档、证据和测试数据形成可审计闭环。
3. 每个事件通过 L1-L3 后记为 `VERIFIED`，提交并以 `--no-ff` 合并到最新 `lint-fix`。
4. 全部事件达到事件级 `VERIFIED` 后，在最新 `lint-fix` 上执行 L4 全平台穷举复验；L4 分母始终保持完整，不得以加速为由缩小范围。
5. L4 的全部适用用例通过、所有测试数据精确清理、所有 BLOCKED 门禁解除、全局文档与检查点一致后，才把待关闭事件更新为 `CLOSED` 并完成 Goal。

历史上已经标记为 `CLOSED` 的事件不降级、不重做实现，但必须纳入最终 L4。`VERIFIED` 不是最终发布关闭；它只表示该事件的定向、聚类、模块和运行时复验已通过。

## 权威输入与读取顺序

每次启动或恢复都按以下顺序读取，不依赖对话记忆猜测进度：

1. 仓库根 `AGENTS.md`、`CLAUDE.md`，以及拟修改目录下更深层的 `AGENTS.md`。
2. `docs/standards/code-quality-baseline-rules.md`、`docs/standards/code-review-checklist.md`。
3. 本目录的 `README.md`、`INDEX.md`、`FQA-COVERAGE-MATRIX.md`、`BLOCKED-READINESS-PLAN.md`。
4. `REMEDIATION-CHECKPOINT.json`；它负责恢复，Git 和事件文档负责校验其真实性。
5. 当前事件目录的 `README.md`、`SPEC.md`、`VERIFICATION.md`、`IMPLEMENTATION-RECORD.md`、`CLAUDE-CODE-PROMPT.md`。
6. 当前事件映射的源 `defects.md`、case、截图、trace、result 和历史执行记录。

发生矛盾时按以下优先级处理：用户最新明确指令 > `AGENTS.md` > 已批准事件 `SPEC.md` > 本文 > 索引/检查点。不得静默选择；把差异写入实施记录，涉及产品语义时暂停请求决定。

## 初始基线门禁

第一次执行 Goal 时，先结算当前文档规划基线，再开始任何事件：

1. 确认当前分支为 `lint-fix`，记录 `git rev-parse HEAD`，检查工作区和全部 worktree。
2. 保留用户已有改动；若出现不属于本整改规划且会与本次提交重叠的改动，暂停说明，不覆盖、不暂存、不删除。
3. 核验事件目录数量、五件套完整性、100 个缺陷唯一映射、索引链接和 JSON 合法性。
4. 文档受 `docs/*` ignore 规则影响。只强制暂存本事件库的 Markdown 与 JSON，不暂存 `.DS_Store`、日志、截图、环境文件或其他 ignored 文件。可使用 Git pathspec 精确暂存：

   ```bash
   git add -f -- ':(glob)docs/plan/full-platform-remediation/**/*.md' docs/plan/full-platform-remediation/REMEDIATION-CHECKPOINT.json
   ```

5. 按仓库规则运行 GitNexus `detect_changes()`；确认只有预期文档后，在 `lint-fix` 创建一次规划基线提交。
6. 将规划提交哈希写入检查点。规划基线不是整改事件，不占用事件分支。

如果规划基线已经提交，则验证该提交可从 `lint-fix` 到达并跳过本步骤，禁止重复提交同一批文档。

## 顺序与断点恢复

严格使用 `REMEDIATION-CHECKPOINT.json` 的 `executionOrder`。只有当前事件合并完成并验证祖先关系后，才能移动到下一项。

每次恢复先执行：

1. 比较当前分支、`lint-fix` HEAD、检查点的 `activeEvent`/`nextEvent` 与事件文档状态。
2. 若存在活动事件分支，继续该分支的第一个未完成门禁，不新建替代分支。
3. 若检查点声称事件已合并，使用 `git merge-base --is-ancestor <eventCommit> lint-fix` 证明；无法证明时修正检查点，不跳过事件。
4. 若 Git、事件文档、索引和检查点不一致，以可验证的提交与证据为准，先做一次仅限台账的一致性修复。
5. 不重跑已经有完整 PASS 证据且未受后续代码影响的 L1-L3；但最终 L4 必须基于最新集成版本完整执行。

## 每个事件的固定循环

### 1. 认领事件

1. 切回 `lint-fix`，确认它是本地最新集成点，工作区干净且无上一个事件残留。
2. 从事件目录名生成分支：`codex/<event-id-lowercase>-<directory-slug>`，例如 `codex/rem-p1-006-permission-consumer-navigation-parity`。
3. 分支必须从当时最新的 `lint-fix` 创建。禁止从前一个事件分支继续派生，禁止把多个事件放进同一分支。
4. 把事件卡状态改为 `IN_PROGRESS`，在实施记录追加起始时间、基线提交、分支、runId、预计触及范围和第一门禁，同时更新检查点。
5. `REM-P1-005` 是历史恢复项：若旧分支已完全合并且是 `lint-fix` 的祖先，先用安全删除确认历史已保留，再从最新 `lint-fix` 以检查点指定的分支名重建；不得硬重置未合并分支。

### 2. 影响分析与合同确认

1. 使用 GitNexus `query` 探索根因执行流，使用 `context` 获取拟修改符号的调用者、被调用者和参与流程。
2. **编辑任何函数、类或方法前，必须对该符号执行 upstream `impact`。** 在实施记录和用户进度更新中写明直接调用者、受影响流程和风险等级。
3. `HIGH` 或 `CRITICAL` 必须在编辑前明确告警。若风险已被事件 SPEC 明确覆盖且不扩大授权边界，可以在告警后按 SPEC 继续；若出现新的产品语义、跨租户授权、不可逆迁移或非测试数据影响，立即暂停请求用户决定。
4. 先验证缺陷仍可复现或用现有证据证明根因仍存在；若已被前序事件消除，只做独立复验和文档结算，不制造无意义代码改动。
5. 只实施当前事件 SPEC 的最小根因修复。不得混入依赖升级、全局格式化、无关重构或顺手修复其他事件。
6. 如果真实代码与 SPEC 冲突，不得为了匹配实现而倒改验收合同；记录差异并在产品语义不明确时暂停。

### 3. 实现与静态验证

1. 保持现有 API、路由、权限、查询键、数据库和审计合同，除非当前 SPEC 明确要求改变。
2. 新增或修改的前端代码不得引入 lint/typecheck 错误，不新增无说明的 `any`。
3. 按事件风险补齐自动化测试，至少覆盖成功、拒绝/无权限、无效输入、边界值、重复操作和无副作用。
4. 从最窄检查开始：相关单测、相关 lint/typecheck，再扩大到根因聚类和受影响模块。
5. 失败必须先归类为本次回归、历史债务或环境问题；只有有证据时才能标记为环境问题，不得把真实回归记为已知失败。

### 4. L1-L3 复验

事件只有完成以下三层并全部满足事件 `VERIFICATION.md` 才能成为 `VERIFIED`：

- **L1 定向层**：变更符号的单元/组件/Controller/Service 测试及每个 AC 的最小复现。
- **L2 根因聚类层**：同一根因的所有 FQA case、正向/反向权限、边界输入、重复操作、持久化与无副作用检查。
- **L3 模块与运行时层**：受影响模块测试、必要的 lint/typecheck/build，以及使用当前事件分支代码构建并替换相应开发容器后的真实 API/UI 复验。

L3 强制要求：

1. 构建来源必须是当前事件分支工作区；记录分支、提交基线、构建命令、容器、健康状态和时间。
2. 只重建受影响应用容器。不得清空数据库卷、Redis、MinIO、全体会话或其他非测试数据；不得用 reset/restore 掩盖失败。
3. 后端重启导致会话失效时，按正常产品流程重新登录并继续，不把重新登录本身视为失败。
4. API 事件必须用真实会话验证；UI 或导航事件必须通过浏览器真实点击路径验证，并检查网络请求、控制台和可见状态。
5. 涉及持久化、对象存储或审计时，使用产品 API 加只读核对证明写入、拒绝、副作用和清理结果。
6. 所有适用 AC 都必须是 `PASS`。任何未解释 5xx、Console error、数据残留、权限旁路或预期外副作用都算 `FAIL`。

代码测试通过但没有运行时 API/UI 复验时，事件只能保持 `VERIFYING`，不得提交为完成、不得合并、不得开始下一事件。

### 5. 测试身份与数据安全

1. 本地开发环境管理员用户名为 `superadmin`。密码只从运行时环境变量 `FQA_SUPERADMIN_PASSWORD` 获取；若变量不可用，向用户安全询问一次并只在当前运行中使用。
2. 绝不把密码、token、Cookie、Authorization header 或其他秘密写入仓库、Prompt、实施记录、证据、日志、命令回显、截图、提交信息或检查点。禁止开启会输出秘密的 shell trace。
3. 其他权限测试账号允许通过产品 API 创建。使用最小权限和唯一 runId：`REM_<eventId>_<yyyyMMdd_HHmmss>`，用户名和对象名均带 runId。
4. 创建对象后立即登记到本次 test-data manifest；按依赖逆序仅通过产品 API 精确清理本次 runId 对象。
5. 禁止直接 SQL、Redis、对象存储删除来伪造清理成功。可使用只读查询核验证据，但不得修改非测试对象。
6. 清理后证明本次 active 对象数和 cleanup failure 都为 0；无法精确清理则事件 `BLOCKED`，并更新解除计划。

### 6. 证据与进度回写

每个事件通过或状态变化时必须同步以下文件：

1. 当前事件 `README.md`：状态、分支、结论、风险、下一门禁。
2. 当前事件 `VERIFICATION.md`：每个 AC 的 L1-L3 结果、命令、运行时证据和 evidence 路径。
3. 当前事件 `IMPLEMENTATION-RECORD.md`：只追加，不覆盖；记录影响分析、代码差异、验证、测试数据、清理、回滚和遗留项。
4. 当前事件 `SPEC.md`：仅在用户批准合同变更时更新；不得用它隐藏实现偏差。
5. `INDEX.md`：事件状态、下一门禁、状态计数和当前队列。
6. `FQA-COVERAGE-MATRIX.md`：源缺陷映射、修复状态和新证据链接；历史首次失败结论保持不变。
7. 本目录 `README.md`：全局汇总计数、当前事件和下一事件。
8. `REMEDIATION-CHECKPOINT.json`：活动事件、分支、runId、最后完成门禁、下一动作、事件提交、状态计数和 blocker。
9. `BLOCKED-READINESS-PLAN.md`：只在 BLOCKED gate 新增、解除或条件变化时更新。

原始 FQA run、首次失败截图和 result 是不可覆盖的历史事实。新证据写入新的 runId 目录；只能追加修复后的映射与结论。

### 7. 提交、合并与分支收敛

只有 L1-L3 全部 PASS、清理完成、文档一致后才执行：

1. 将事件状态更新为 `VERIFIED`。运行文档链接/JSON/格式检查及仓库要求的相关检查。
2. 运行 GitNexus `detect_changes()`；同时审查相对事件分支基线的差异，并按仓库规则完成默认分支比较。确认符号与执行流只落在事件预期范围；意外范围必须先解释或修正。
3. 精确暂存当前事件代码、测试、事件文档、必要证据和全局进度文件。禁止使用无审查的 `git add .`，禁止带入用户无关改动、构建产物或秘密。
4. 在事件分支创建正常提交，提交信息包含事件 ID。验证提交存在且工作区干净。
5. 切回 `lint-fix`，确认 HEAD 未被其他工作改动；若已变化，先重新基于最新集成点验证冲突和必要回归。
6. 使用 `git merge --no-ff --no-commit <event-branch>`。在这个待提交合并中，把检查点推进到下一事件，并记录刚生成的 event commit；检查 JSON 和文档一致性后创建 merge commit。
7. 运行 `git merge-base --is-ancestor <eventCommit> lint-fix`、检查 merge commit 和工作区状态。只有全部成立才算集成成功。
8. 安全删除已合并的本地事件分支，然后开始下一事件。不得删除未合并分支，不得 push，除非用户另行明确要求。

每个完成事件向用户给出一条简短进度：事件 ID、分支、关键 PASS、event commit、merge commit、整体计数和下一事件。

## FAIL、BLOCKED 与暂停规则

- `FAIL`：继续留在当前事件分支定位并修复，不跳到下一事件，不通过改预期掩盖失败。
- `BLOCKED`：写明已完成工作、阻塞证据、责任边界、解除条件和安全恢复步骤；保存检查点，保留事件分支，不合并为完成。
- 中断或上下文压缩：先更新检查点和实施记录，再停止；恢复时从同一事件的第一项未完成门禁继续。
- 不要因为任务耗时、测试慢或上下文不足而降低验收标准。

以下动作超出本 Goal 的自动授权，必须暂停请求用户明确决定：

- 切换全租户授权模式、执行 break-glass、批量权限迁移或修改非测试角色/授权；
- 数据库/对象存储 restore、全量 purge、重建卷、清空 Redis 或全体会话；
- 修改非测试对象、历史数据回填、不可逆迁移或需要停机的全局操作；
- 连接或修改真实 SMTP、Prometheus、Alertmanager、Grafana、AI provider 或外部秘密；
- push、发布、创建 PR、合并到 `development`/`page_split` 或操作远端分支；
- 任何超出当前事件 SPEC、会改变产品语义或无法精确回滚的动作。

## 最终 L4 全平台复验

当检查点显示除历史 `CLOSED` 外的所有事件均为 `VERIFIED`，才进入 L4：

1. 从最新且干净的 `lint-fix` 创建 `codex/fqa-final-l4-revalidation`，该分支只记录全量复验和关闭文档，不混入未经事件化的代码修复。
2. 按 `docs/acceptance/full-platform-exhaustive-functional-test-v1.0/` 的当前测试合同创建新的唯一 runId，冻结环境基线并执行完整 `275+78` 矩阵及跨模块状态检查。
3. 按 `BLOCKED-READINESS-PLAN.md` 逐项解除 gate。没有执行的用例不得标 PASS；最终完成要求适用范围内 `FAIL=0`、`BLOCKED=0`、cleanup failure=0。
4. 新发现产品缺陷时，停止 L4 关闭：映射或新建独立 REM 事件，在新的事件分支完成 L1-L3 后，从最新 `lint-fix` 恢复同一 L4 run。必须重跑 GitNexus/代码差异确认的受影响用例、相关跨模块状态边和全部尚未执行项；同一 run 中已有完整原始证据、台账可追溯、清理完成且经影响分析证明未受后续变更影响的 PASS 可以保留，禁止为了形式完整而重跑这些无影响项，也禁止把部分覆盖、历史其他 run 或源码推断当作当前 run PASS。
5. L4 全部通过后，更新所有 `VERIFIED` 事件为 `CLOSED`，回写各事件验证结论、总索引、覆盖矩阵、根 README、最终测试报告和检查点。
6. 对 L4 文档分支运行 `detect_changes()` 和文档验证，提交并 `--no-ff` 合并到 `lint-fix`，验证祖先关系并安全删除本地分支。

### L4 加速与并行合同

1. 完整范围固定为当前实时目录推导出的全部功能和状态用例，当前合同为 `275+78`；加速只改变调度和证据复用，不改变用例、验收标准、适用性或关闭条件。
2. 可以复用现有 Playwright/API/单测资产并组合多个 case，但每个 case 只有在其全部适用验收点均有当前 run 证据时才可 PASS；组合测试的部分成功不自动提升聚合 case。
3. 无产品写入、无共享 manifest 写入、无共享账号/会话、无配置切换、无固定端口/mock 状态和无夹具冲突的只读批次，可以按模块并行；每个 Playwright 进程必须使用独立 `--output` 目录。
4. 任何写入、授权模式切换、break-glass、迁移/backfill、审批或业务状态机、配置快照/恢复、共享 manifest 和精确清理链路必须严格串行；不得同时运行两个会整体覆盖同一 manifest 的测试。
5. 每次并行批次结束必须先汇总 Console/Network/trace、case 结果和清理状态，再更新台账；任一 FAIL 只停止其依赖批次，不得把未实际完成的同组用例记 PASS。
6. L4 continuation 不创建新的全量 runId，除非原 run 的基线、证据或台账已不可验证。正常 REM 修复后在同一 run 中保留未受影响 PASS，追加 event/merge 基线和受影响复验；不得“完全重置”后丢失已完成证据。

## Goal 完成标准

只有以下条件同时成立，才能把 Goal 标记为完成：

- 86 个已登记事件均有完整、相互一致的最终状态和证据；待整改事件全部为 `CLOSED`，不存在 `IN_PROGRESS`、`VERIFYING`、`VERIFIED`、`FAIL` 或 `BLOCKED` 遗留。
- 100 个 `BUG-FQA-*` 仍保持唯一主事件映射，且每个修复后结论可追溯到新的 L4 证据。
- L4 全平台复验完成，适用范围内 `FAIL=0`、`BLOCKED=0`，测试数据和临时权限精确清理。
- 每个事件都有自己的 event commit 和 `lint-fix` merge commit，可证明祖先关系；没有未合并事件分支。
- `README.md`、`INDEX.md`、`FQA-COVERAGE-MATRIX.md`、事件文档、最终报告和 `REMEDIATION-CHECKPOINT.json` 数量与状态一致。
- `lint-fix` 工作区干净，无秘密、无测试账号凭据、无意外构建产物、无未解释代码质量回归。
- 未执行 push、发布或合并其他长期分支，除非用户在 Goal 运行期间另行明确授权。

只完成一部分事件、只通过自动化测试、只实现代码、只生成报告或留下待复验项，都不满足本 Goal。
