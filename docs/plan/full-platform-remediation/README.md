# 全平台整改事件库

本目录承接 `full-platform-exhaustive-functional-test-v1.0` 的缺陷整改。组织原则是：**一个可独立实施、验证和回滚的修复事件，对应一个独立目录**。禁止把多个根因只因出现在同一页面或同一轮测试中合并为一个大修复。

## 从哪里开始看

1. 使用 Codex 长期顺序执行时，先读 [CODEX-GOAL-PROMPT.md](./CODEX-GOAL-PROMPT.md)，再从 [REMEDIATION-CHECKPOINT.json](./REMEDIATION-CHECKPOINT.json) 恢复当前事件。
2. 人工查看整体队列时看 [INDEX.md](./INDEX.md)，按优先级、状态和下一门禁选择事件。
3. 进入事件目录先看 `README.md`，一分钟内了解问题、影响、边界和当前进度。
4. 实施前看 `SPEC.md`；测试与复查按 `VERIFICATION.md` 执行。
5. 单事件执行时，把事件目录内的 `CLAUDE-CODE-PROMPT.md` 作为该任务的完整入口。
6. 开始实现后持续更新 `IMPLEMENTATION-RECORD.md`，记录代码变更、GitNexus 影响、验证结果、回滚和遗留项。

当前规划含 111 个唯一事件：4 个已关闭、107 个已验证。`REM-P1-072` 已完成 CMDB CSV 导入失败行下载的 L1-L3，等待事件提交和顺序 no-ff 合并；随后恢复同 run `XL-EXPORT-004` affected-only，已有 PASS 证据保持不变。

## 目录规则

```text
full-platform-remediation/
├── README.md
├── INDEX.md
├── CODEX-GOAL-PROMPT.md
├── REMEDIATION-CHECKPOINT.json
├── FQA-COVERAGE-MATRIX.md
├── BLOCKED-READINESS-PLAN.md
├── _templates/
│   ├── remediation-event-template.md
│   └── CLAUDE-CODE-PROMPT.template.md
└── <领域序号>-<领域名>/
    └── REM-<优先级>-<三位序号>-<简短事件名>/
        ├── README.md
        ├── SPEC.md
        ├── VERIFICATION.md
        ├── CLAUDE-CODE-PROMPT.md
        └── IMPLEMENTATION-RECORD.md
```

领域目录使用稳定序号，建议范围如下：

| 序号 | 领域 | 示例 |
|---|---|---|
| `01` | 安全与统一授权 | membership、assignment、ACL、session、cutover |
| `02` | 账号与组织 | 用户、组、资料、密码、会话管理 |
| `03` | CMDB 与资产 | 模型、实例、设备、IPAM、拓扑 |
| `04` | 内容与文件 | Wiki、共享文件、上传下载、MinIO 生命周期 |
| `05` | 流程与变更 | Workflow、变更文档、审批、导出 |
| `06` | 运维协作 | 日报、日历、任务、通知 |
| `07` | 平台与集成 | 配置、AI、报表、审计、备份 |
| `08` | 横切合同 | 输入校验、DTO、错误处理、状态机一致性 |

只有出现实际事件时才创建领域目录，不建立空目录。领域目录名以本事件库已登记名称为准，不因后续实现重命名。

## 事件拆分规则

满足以下任一条件就应拆成不同事件：

- 根因不同，即使用户表现相邻；
- 需要不同的发布、回滚或数据迁移策略；
- 可以独立验收和关闭；
- 一个修复会跨越两个以上高风险模块，而另一修复不需要；
- 严重度、授权窗口或外部依赖不同。

同一根因造成多个页面表现时保留一个事件，但在 `VERIFICATION.md` 中逐条映射所有独立用例和证据。

## ID 与状态

- 事件 ID：`REM-P0-001`，ID 一经登记不得复用或重编号。
- 目录名：`<事件ID>-<可读短名>`，短名只用于人读，追溯以 ID 为准。
- 状态：`DRAFT -> READY -> IN_PROGRESS -> VERIFYING -> VERIFIED -> CLOSED`。`VERIFIED` 表示事件级 L1-L3 已通过，`CLOSED` 仍需最终 L4。
- 特殊状态：`BLOCKED`、`ROLLED_BACK`、`SUPERSEDED`；必须写原因和后继事件。
- `CLOSED` 必须同时满足 SPEC 验收、验证矩阵无未解释项、实施记录完整和索引更新。

## 追溯要求

每个事件至少形成以下双向链路：

```text
测试 run / defect / case / evidence
              ↓
        REM 事件与 SPEC
              ↓
代码符号 / 数据合同 / 实施记录
              ↓
自动化测试 / 定向复查 / 模块回归
              ↓
新的 evidence / 关闭结论
```

事件文档必须记录源 runId、缺陷 ID、用例 ID、证据路径、受影响符号、验收项 ID 和验证结果。不得用“已修复”“测试正常”代替可定位证据。

总覆盖额外要求：`defects.md` 的每个 `BUG-FQA-*` 必须在 `FQA-COVERAGE-MATRIX.md` 中恰好出现一次主映射；checkpoint 漏记或保留已关闭编号时，必须在矩阵中显式对账，不能静默丢弃或重复建事件。

## 文档与代码边界

- 本目录是整改计划和实施台账，不替代原始测试报告；原始证据保持只读。
- 写 SPEC 不代表授权修改业务代码。实施开始前仍须按仓库规则对每个拟修改符号运行 GitNexus `impact`。
- `HIGH/CRITICAL` 变更必须先在事件卡和实施记录中告警，确认回归范围后再实现。
- 每个事件独立提交、独立验证、独立回滚；不要把无关清理混入 P0/P1 修复。
- `CLAUDE-CODE-PROMPT.md` 必须是事件专用的完整执行合同，不得只写“请按 SPEC 修复”。它至少要明确读取顺序、授权边界、已决策合同、实施步骤、验证层级、证据回写和停止条件。
- prompt 不得包含密码、token 或其他秘密，也不得默认授权 Git 提交、历史数据迁移、全租户切换、restore 或修改非测试授权。

## Codex Goal 执行约定

- Goal 在单一工作区中顺序执行；`REM-P1-065` 已完成 L1-L3，正等待独立提交与 no-ff 合并；合并前不得继续 L4。每个事件从最新 `lint-fix` 创建独立分支，完成 L1-L3 运行时复验后提交并 `--no-ff` 合并，再进入下一事件。
- `REMEDIATION-CHECKPOINT.json` 是中断恢复入口，但必须用 Git 提交、事件文档和证据校验，不能把检查点声明当成完成证据。
- 事件级 L1-L3 全部通过后状态为 `VERIFIED`；全部事件完成后还要执行独立 L4 全平台复验，L4 通过后才统一 `CLOSED`。
- 每次状态变化同步事件卡、验证矩阵、实施记录、`INDEX.md`、`FQA-COVERAGE-MATRIX.md`、本 README 和检查点；只有 BLOCKED gate 改变时更新解除计划。
- 管理员凭据只能在运行时安全提供，不得进入仓库、Prompt、日志、截图、证据或提交；其他权限账号使用带 runId 的产品 API 创建并精确清理。
