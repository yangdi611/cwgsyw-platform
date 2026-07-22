# 整改事件目录模板

复制整个事件目录结构，不要只复制本文件。推荐目录名：

```text
REM-<P0|P1|P2|P3>-<三位序号>-<可读短名>/
├── README.md
├── SPEC.md
├── VERIFICATION.md
├── CLAUDE-CODE-PROMPT.md
└── IMPLEMENTATION-RECORD.md
```

## `README.md`：事件卡

必须包含：

- ID、标题、优先级、领域、状态、负责人、创建/更新时间；
- 一句话问题与用户影响；
- 源 runId、缺陷、用例、证据；
- 根因聚类；
- scope、non-goals、依赖、风险和下一门禁；
- 本目录文件导航。

## `SPEC.md`：实施合同

必须包含：

- 目标与运行时不变量；
- 当前行为和目标行为；
- API、服务、数据、权限、审计、会话和兼容合同；
- 预计修改文件/符号与 GitNexus 影响分析；
- 分步实施、迁移、可观测性、回滚和停止条件；
- 使用稳定编号的验收条件，例如 `AC-001`。

## `VERIFICATION.md`：验证与证据矩阵

必须包含：

- `AC-* -> caseId -> 测试层 -> 证据路径 -> 结果` 的映射；
- 原始失败证据和修复后证据分开保存；
- 定向复查、根因聚类回归、模块回归、发布前全量回归四层策略；
- PASS/FAIL/BLOCKED 规则、清理核验和关闭门禁。

## `IMPLEMENTATION-RECORD.md`：追加式实施记录

必须包含：

- 当前状态和每次状态变化；
- 实际修改文件、符号、提交或 diff 标识；
- 实施前 GitNexus `impact` 与实施后 `detect_changes`；
- 每次验证命令、结果、证据和失败诊断；
- 数据变更、回滚演练、遗留风险和最终关闭批准。

创建事件时可把状态初始化为 `NOT_STARTED`，但不要伪造实施或验证结果。

## `CLAUDE-CODE-PROMPT.md`：Claude Code 执行入口

从 [CLAUDE-CODE-PROMPT.template.md](./CLAUDE-CODE-PROMPT.template.md) 复制后按事件改写。必须包含：

- 明确唯一事件 ID、目标和完成定义；
- 要求从 checkpoint/实施记录继续，不重复已完成工作；
- 仓库规则、事件文档、原始证据的完整读取顺序；
- 允许和禁止的修改范围，以及需要额外授权的高风险操作；
- GitNexus `query/context/impact/detect_changes` 门禁；
- 已批准的产品语义，不能让执行者临场猜测关键合同；
- 实施、定向测试、根因回归、模块回归、证据和清理要求；
- 必须回写 `IMPLEMENTATION-RECORD.md`、`VERIFICATION.md`、事件卡和总索引；
- 遇到越界、数据不可逆或合同冲突时的停止条件。

prompt 自身不得包含密码、token、cookie、私钥或测试账号临时密码。
