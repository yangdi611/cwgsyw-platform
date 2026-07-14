# Claude Code 执行 Prompt 模板

> 将本模板复制到具体整改事件目录并命名为 `CLAUDE-CODE-PROMPT.md`。替换所有 `<...>`；删除与事件无关的说明。最终文件必须可作为 Claude Code 的独立任务入口直接执行。

## Prompt 正文

你现在位于 `<项目绝对路径>`，要持续完成唯一整改事件 `<事件ID：标题>`。

这不是调研或只写计划的任务。请从事件现有状态继续，完成代码修复、验证、证据和文档回写；不要重新创建另一套 SPEC，也不要扩展到其他整改事件。未达到关闭条件时，不得声称完成。

### 1. 首先完整读取

按顺序读取且遵守：

1. `AGENTS.md`
2. `CLAUDE.md`
3. 触及目录下更深层的 `AGENTS.md` / `CLAUDE.md`
4. `docs/plan/full-platform-remediation/README.md`
5. `docs/plan/full-platform-remediation/INDEX.md`
6. `<事件目录>/README.md`
7. `<事件目录>/SPEC.md`
8. `<事件目录>/VERIFICATION.md`
9. `<事件目录>/IMPLEMENTATION-RECORD.md`
10. SPEC 引用的源缺陷、用例台账和原始证据

读取实施记录后，从第一个未完成门禁继续；已经有证据的步骤不得无故重做。

### 2. 任务目标与已批准合同

- 目标：`<一句话目标>`
- 必须保持的不变量：`<关键不变量>`
- 已批准实现决策：`<明确方案，不留关键 PENDING>`
- 非目标：`<不可顺手修复的关联问题>`

若源码与 SPEC 冲突，先用只读证据确认；会改变产品合同、数据库或事件边界时停止并报告，不得自行扩大范围。

### 3. 强制工程门禁

1. 先检查 branch、commit、工作区状态，保留所有用户已有改动。
2. 先用 GitNexus `query` / `context` 追踪真实调用链。
3. 编辑任何函数、类或方法前，对该符号运行 upstream `impact`，把 direct callers、processes、modules 和风险写入实施记录。
4. `HIGH/CRITICAL` 必须先向用户明确告警；若结果不超过 SPEC 已记录范围，可在告警后继续。若影响扩大，停止并请求确认。
5. 使用最小、根因级改动；不要混入格式化、重构、依赖升级或其他缺陷修复。
6. 修改完成后运行 GitNexus `detect_changes`，确认只影响预期符号和流程。
7. 不提交、不 push、不建 PR，除非用户另行明确要求。

可以用 subagent 并行处理彼此独立的只读源码分析、测试设计、证据核对和模块回归；主执行者必须亲自读取规则与事件合同、汇总结果并负责最终判断。不要让多个 agent 同时编辑同一文件或同一授权核心链路。

### 4. 安全边界

- 不写入或输出密码、token、cookie、secret。
- 测试数据全部带 `<remediationRunId>` 并即时登记；只清理能确认属于本次的对象。
- 禁止直接修改 password hash、授权关系表或业务状态来绕过产品流程。
- 禁止全租户 Enforce/Rollback、restore、全局 session 清理、历史数据批量迁移和修改非测试授权，除非用户单独明确批准。
- 不修改 superadmin 的密码、状态、资料、membership、assignment 或权限。
- 数据不可精确恢复、需要修改非测试对象或出现未解释 5xx 时立即停止并记录 BLOCKED/FAIL。

### 5. 实施与验证

按 `SPEC.md` 分步实施，并把每步实际文件、符号和决策追加到 `IMPLEMENTATION-RECORD.md`。

验证节奏：

1. L1 定向复查：`<用例>`
2. L2 根因聚类回归：`<用例>`
3. L3 受影响模块回归：`<模块>`
4. L4 发布关闭全量回归：只在事件 SPEC 要求且环境具备时执行；否则明确记录为后续发布门禁，不伪造 PASS。

每个 FAIL 立即保存首次失败证据和只读根因线索。测试后按产品接口逆序清理，核对非测试数据和授权前后相同。

### 6. 必须回写

- `IMPLEMENTATION-RECORD.md`：状态、实际 diff、GitNexus、测试、证据、回滚和残余风险。
- `VERIFICATION.md`：每个 `AC-*` 的实际 PASS/FAIL/BLOCKED 与证据路径。
- 事件 `README.md`：当前状态和下一门禁。
- 总 `INDEX.md`：事件状态、验证状态和下一步。

原始测试 run 是历史记录，只新增修复后证据和映射，不覆盖原失败证据。

### 7. 完成输出

最终只报告：事件结论、修改文件、验证结果、证据路径、清理结果、仍需用户决定的事项。只有全部关闭条件满足才能标记 `CLOSED`；否则准确标记 `VERIFYING`、`FAIL` 或 `BLOCKED`。

现在开始：先读取规则和事件实施记录，然后执行第一个未完成门禁，不要停在计划阶段。
