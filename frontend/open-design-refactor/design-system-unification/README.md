# Design System 统一治理资料包

本目录用于指导 `components/ui` 与 `components/v2` 的合并，并在合并过程中评估是否向 Intent UI 演进。

本资料包与 `frontend/open-design-refactor/ai-implementation/` 的页面统一化资料分工如下：

- 页面统一化资料：页面 Shell、列表、详情、表单、工作区和路由迁移。
- 本资料包：基础组件的唯一入口、组件 API、设计 token、兼容层、迁移顺序和 Intent UI 决策。

本资料包既用于规划，也用于承接当前分支的 DS-00～DS-05 实施证据。DS-03 批次 1～6 已完成，DS-04 隔离 spike 已通过静态和运行时门禁，DS-05 已决定继续以 Base UI 作为默认底层。文档本身不等于总体任务完成，不删除现有组件，不提交或推送。

## 当前基线

- 前端使用 Next.js 16、React 19、Tailwind CSS 4。
- `components/ui` 是 shadcn 风格组件，交互底层主要使用 `@base-ui/react`。
- `components/v2` 是 V2 主题包装和少量自定义基础组件。
- `components/shared` 是页面级组合组件，不应与基础组件合并。
- `globals.css` 已提供 `--v2-*` 设计变量和对应 Tailwind 工具类。
- 业务页面和业务组件直接引用 `components/ui` 与 `components/v2` 的数量已降为 0；ESLint 已阻止新增 legacy 业务导入。
- `components/ui` 只作为 `design-system` 内部实现，`components/v2` 只作为 compatibility re-export；旧目录尚未获准删除。
- DS-03 的 development 真实路由和 `1440x900`、`1024x768`、`390x844` 验收已记录为 `VERIFIED`；DS-04 已 `VERIFIED`，DS-05 已选择 `BASE_UI_DEFAULT`，DS-06 静态审计已完成，当前等待负责人 review。

## 文档索引

| 文档 | 用途 |
|---|---|
| `START-HERE.md` | 项目负责人第一次接手时的最短操作路径 |
| `ARCHITECTURE-DECISION.md` | 目标分层、职责边界和不可变原则 |
| `COMPONENT-CONTRACT.md` | 基础组件 API、状态和可访问性合同 |
| `MIGRATION-PLAN.md` | 分阶段迁移顺序、依赖门、回滚和验收 |
| `MASTER-PLAN.md` | 总体目标、当前状态、执行合同和项目负责人操作顺序 |
| `INTENTUI-DECISION.md` | Intent UI 技术验证和采用决策门 |
| `DS-04-SPIKE-PROTOCOL.md` | 独立试验的授权、实现、验收和回滚协议 |
| `ACCEPTANCE-CHECKLIST.md` | 每个迁移批次的静态、行为和视觉验收 |
| `TASK-GOAL-PROMPT.md` | 可直接粘贴到 AI Goal 的主任务 Prompt |
| `STATUS.md` | 本资料包对应的实施状态台账 |

## 目标结构

```text
frontend/src/components/
├── design-system/       # 基础 UI 唯一公开入口
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Dialog.tsx
│   ├── Select.tsx
│   ├── Card.tsx
│   ├── StatusBadge.tsx
│   └── index.ts
├── shared/              # 页面级组合组件，继续保留
├── ui/                  # 迁移期间的 legacy 实现，不再被业务页面新增引用
└── v2/                  # 迁移期间的 compatibility re-export，最终移除
```

页面和业务组件最终只允许从 `@/components/design-system` 或 `@/components/shared` 导入。

## 推荐执行入口

1. 先阅读 `START-HERE.md`，确认当前分支、执行指针和负责人操作。
2. 再阅读 `MASTER-PLAN.md`、`ARCHITECTURE-DECISION.md` 和 `COMPONENT-CONTRACT.md`。
3. 按 `STATUS.md` 顶部当前指针继续；DS-04、DS-05 和 DS-06 静态审计已完成，当前进入负责人 review，不重做 DS-03，不把隔离 spike 依赖扩散到主迁移路径。
4. 使用 `TASK-GOAL-PROMPT.md` 启动或续跑任务。
5. 每个批次按 `ACCEPTANCE-CHECKLIST.md` 验收，并在 `STATUS.md` 留证；代码/静态通过不等于运行时 `VERIFIED`。
6. Intent UI 技术验证已完成；后续只有在单独授权的组件族迁移任务中，才可依据 `INTENTUI-DECISION.md` 评估替换底层实现。
