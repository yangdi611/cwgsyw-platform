# 全平台整改事件库

本目录承接 `full-platform-exhaustive-functional-test-v1.0` 的缺陷整改。组织原则是：**一个可独立实施、验证和回滚的修复事件，对应一个独立目录**。禁止把多个根因只因出现在同一页面或同一轮测试中合并为一个大修复。

## 从哪里开始看

1. 先看 [INDEX.md](./INDEX.md)，按优先级、状态和下一门禁选择事件。
2. 进入事件目录先看 `README.md`，一分钟内了解问题、影响、边界和当前进度。
3. 实施前看 `SPEC.md`；测试与复查按 `VERIFICATION.md` 执行。
4. 需要 Claude Code 执行时，把事件目录内的 `CLAUDE-CODE-PROMPT.md` 作为该任务的完整入口。
5. 开始实现后持续更新 `IMPLEMENTATION-RECORD.md`，记录代码变更、GitNexus 影响、验证结果、回滚和遗留项。

当前进行中的事件是 `REM-P1-002`：成员列表软删除一致性，位于 `02-account-organization/REM-P1-002-membership-list-soft-delete-consistency/`。它独立处理 `BUG-FQA-016`，不与已关闭的 P0 membership assignment 失效事件混合；发布前全量复验仍是所有事件的最终共同门禁。

## 目录规则

```text
full-platform-remediation/
├── README.md
├── INDEX.md
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

只有出现实际事件时才创建领域目录，不建立空目录。

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
- 状态：`DRAFT -> READY -> IN_PROGRESS -> VERIFYING -> CLOSED`。
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

## 文档与代码边界

- 本目录是整改计划和实施台账，不替代原始测试报告；原始证据保持只读。
- 写 SPEC 不代表授权修改业务代码。实施开始前仍须按仓库规则对每个拟修改符号运行 GitNexus `impact`。
- `HIGH/CRITICAL` 变更必须先在事件卡和实施记录中告警，确认回归范围后再实现。
- 每个事件独立提交、独立验证、独立回滚；不要把无关清理混入 P0/P1 修复。
- `CLAUDE-CODE-PROMPT.md` 必须是事件专用的完整执行合同，不得只写“请按 SPEC 修复”。它至少要明确读取顺序、授权边界、已决策合同、实施步骤、验证层级、证据回写和停止条件。
- prompt 不得包含密码、token 或其他秘密，也不得默认授权 Git 提交、历史数据迁移、全租户切换、restore 或修改非测试授权。
