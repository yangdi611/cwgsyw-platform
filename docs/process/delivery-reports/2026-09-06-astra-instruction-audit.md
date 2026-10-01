# Astra 持久化指令精简 — 本地交付报告

日期：2026-09-06。状态：本地修改与静态核验完成，待人工审阅；不是 Linear `Done` 或发布完成。

## 依据与阅读范围

- [OpenAI GPT-6 Astra Model Guidance](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6-astra)：已通过浏览器阅读选中的 Astra 全文，包括行为、主动执行、指令冲突、表达、委派、测试和迁移参数章节。采用其按风险校准验证、明确授权边界及清理冲突指令的建议；没有改应用模型/API 参数。
- [Eric Provencher — Rethinking skills and prompts for GPT-6 Astra](https://x.com/pvncher/status/2095991462416490862)：已阅读全部正文与两张指导性配图。采用短而准确的技能描述、按需披露、删去历史脚手架和明确完成边界的实践建议，不将经验文章当作项目安全授权。
- 网页搜索工具未返回可用正文；以上阅读来自浏览器原站，而非搜索摘要或内置模型知识。

## 身份、授权例外与范围

- 分支：`codex/astra-instruction-audit`；创建前工作区干净，HEAD 与本地 `origin/development` 一致。没有 fetch、commit、push、PR、外部状态更新或部署。
- 开始状态：`READY WITH APPROVED EXCEPTION`。用户于本任务明确要求“直接完成…精简与修改”；将其限定为本次本地指令维护授权。
- 缺失门槛：没有真实 Linear ID、负责人/优先级等跟踪元数据，因此分支没有伪造 ID。例外不授权应用实现、外部操作或未来绕过 DoR。
- 原因：直接执行用户请求的可回滚指令维护。风险为中等流程风险，影响后续代理的阅读、验证、工具选择；没有应用函数、契约实现、数据库或部署配置变更。
- 临时控制：原始文件完整备份，窄分支，保留人类授权/安全门禁，静态检查，不改变全局配置、全局技能或第三方插件缓存。
- 后续：如需团队采用、提交或推进流程状态，需用户提供/授权关联真实 Linear issue，补充例外记录与人工流程审阅。拟由项目所有者确认，状态为待授权；没有创建虚构 issue。本例外在本地审阅交付时到期。

## 实际生效面与发现

| 层级 | 发现与处理 |
|---|---|
| 全局 AGENTS | `~/.codex/AGENTS.md` 仅包含条件式 Herdr 完整读取规则；保留。上级目录未找到额外 AGENTS/override。 |
| 全局工作流 | 已读取 `~/.codex/workflows/software-delivery/` 的流程与 DoR/DoD；保留最低治理门槛，项目改为适用章节一次加载。 |
| 项目入口 | 根 AGENTS 与前端 AGENTS；根 CLAUDE 是 Claude 的入口，不是 Codex 默认目录指令。两者不再各自维护全套策略。 |
| 技能发现 | `.agents/skills/` 原有 26 个入口：20 个生成的图聚类清单、6 个 GitNexus 流程。生成清单触发条件覆盖整个前/后端，且 `auth`/`rbac`/`id` 聚类不是可靠模块边界。 |
| Claude 副本 | `.claude/skills/` 存在相同技能副本（CLI 文案略有不同）；删除生成技能入口，其余改为链接到共享技能。 |
| 前端历史规则 | 旧 CLAUDE 的 Next.js 15、UI 路径及阶段信息过时；当前 package.json 为 Next.js 16.3.0，Figma Neutral 组件已被页面使用，`src/components/ui/` 不存在。更新入口和仍禁止页面导入的 M0/M1 README。 |
| 全局/插件技能 | 当前发现列表仍有全局 GitNexus、Herdr、Railway 重复来源；Railway 的泛化触发及 Intent UI 的组件路径/prop 要求有误路由风险。只记录，不跨项目改写这些安装。项目明确保留实际设计系统。 |
| 其他控制面 | 检查了本地配置的指令/模型相关键、Claude 设置顶层与 hooks 状态、PR 模板及质量规范；没有发现项目 `.codex/config.toml` 或 Claude hooks。未读取无关密钥值、聊天历史或修改工具权限。 |

## 删除、调整与保留

- 删除每次编辑前全量读文档、固定图查询序列、无条件重建索引、默认全套测试、必然添加镜像实现测试、每次机械步骤重复验证等要求。
- 将任意符号都分析改为核心服务/控制器、权限/工作流、公共契约、CMDB、迁移和大型重构的影响门槛；保留 HIGH/CRITICAL 预警与未解决安全风险阻断。工具不可用时需如实说明并给出源代码依赖证据。
- 将图中的直接调用者从“一定损坏”改为“可能受影响”；比较基准改为实际任务目标分支，通常 `origin/development`，稳定分支审查才用 `master`。
- 20 个生成技能降为只按需读取的导航快照，保留原有 Key Files/符号/流程数据并标明可能过时。6 个 GitNexus 技能改为短任务指引，不再重复教程和清单。
- 根 CLAUDE 的历史迁移、功能完成状态、命令全集、示例密码/密钥不再驻留上下文；必要业务与安全陷阱集中在 `docs/standards/project-contracts.md`。历史原件仅在私有备份，不把旧描述重新声明为当前架构。
- 保留 Linear 真 ID、DoR/DoD、文档影响评估、用户改动保护、外部变更授权、发布门禁、RBAC/租户/软删/审计/API/JSONB 约束及代码质量底线。未添加委派配额或模型专用工具假设。

## 规模（字节不是 Token 测量）

| 入口 | 修改前 | 修改后 |
|---|---:|---:|
| 根 AGENTS | 82 行 / 8,222 字节 | 39 行 / 6,063 字节 |
| 根 CLAUDE | 690 行 / 48,575 字节 | 12 行 / 574 字节 |
| Codex 项目 SKILL 入口 | 26 个 / 97,240 字节 | 6 个 / 6,412 字节 |

这是入口文本与发现数量的减少，不是实测总 Token 节省率；按需参考文件和全局技能仍可能被加载。

## Verification Evidence

| 检查 | 方法 | 结果 |
|---|---|---|
| 备份完整性 | 65 份原文件逐个 SHA-256 对照 | PASS |
| 技能结构 | 官方 skill-creator `quick_validate.py` 的 `validate_skill` 检查 12 个剩余入口 | PASS |
| 技能路由 | 解析本地 Markdown 引用并检查目标存在，共 28 条 | PASS |
| 导航数据保留 | 20 个新 reference 与原始 Key Files 后的数据逐段比较 | PASS |
| 规则与契约复核 | 人工核对授权门槛、业务约束、DoR/DoD、按风险验证；核对当前前端源码/组件路径 | PASS |
| 差异与格式 | `git diff --check`；检查技能/入口冲突标记、尾空格与实际差异 | PASS |
| 应用测试、lint、构建 | 无应用实现变更，不验证纯文案措辞的镜像测试 | NOT RUN（不适用） |
| GitNexus impact/detect_changes | 未编辑函数/类/方法，也未提交；文档范围以文件差异验证 | NOT RUN（不适用） |
| 行为 A/B 或新任务回放 | 未启动独立代理/新任务；静态核验不证明实际 Token/速度提升 | NOT RUN |
| CI、人工审阅、Linear/PR/发布 | 当前未授权外部步骤 | NOT RUN |

## Documentation Impact Assessment

| 必评项 | 决策 | 理由及权威路径 |
|---|---|---|
| PRD/功能需求 | Not applicable | 没有改变产品行为或功能验收标准；范围来自当前用户请求。 |
| ADR | Not applicable | 没有新增技术架构/兼容性决策；代理流程调整记录于本报告及 `docs/process/WORKFLOW.md`。 |
| API/数据模型/迁移/安全/运维文档 | Create / Update | 新建 `docs/standards/project-contracts.md` 集中原有约束，更新质量检查说明和前端设计系统 README；没有变更 API、schema、迁移、安全实现或部署运行手册契约。 |
| Current System Baseline | Update | 更新 `AGENTS.md`、`docs/process/WORKFLOW.md` 的代理流程基线及前端现状说明；2026-07-07 的 `docs/audit/code-quality-baseline.md` 保留历史快照，不冒充当前测试结果。 |
| 后续文档任务 | Follow-up task | 团队采用/全局技能去重需另行确认范围和真实 Linear ID；项目所有者待确认，尚未授权创建。当前本地文档已更新，但不声称 tracker Done。 |

本评估尚未写入 Linear：没有 issue ID，且未获外部变更授权。

## 本地文件与回滚边界

- Git 可见的已跟踪变更有 8 个文件。`CLAUDE.md`、前端 AGENTS、技能目录、质量规范和本报告受到现有 `.gitignore` 规则影响；它们在本机已修改，但不能仅靠 `git diff` 查看或交付到其他机器。
- 未修改 `.gitignore`，未强制 stage。未来提交需人工确认哪些本地指令应纳入版本控制；不得假设全部文件会随普通提交分发。
- 原始备份：`/Users/byron/.codex/backups/cwgsyw-astra-20260906-u2fi98iy`（目录仅当前用户可访问）。`manifest.json` 保存原始哈希，`changes.json` 列出本次新增、修改、移除文件。
- 回滚时按清单逐文件比对后恢复备份；仅移除本次新建且此后未被改动的文件。不要执行整仓 reset/clean，避免覆盖后续用户工作。
- 当前会话已经注入的旧文本不可能通过磁盘编辑撤回；后续任务需要重新加载更新的指令。全局技能/插件约束仍存在，不宣称本次已消除所有跨项目冲突。

## 2026-09-07 提交与本地合并授权

- 用户明确授权 commit 并合并到 `development`；按本任务未跟踪指令维护例外继续执行，状态为 `READY WITH APPROVED EXCEPTION`。仍无 Linear ID，不伪造、不更新 tracker Done。
- 授权范围为本次完整交付文件集的提交与本地合并，不含远端 push、PR 或部署。此前“未提交/未强制 stage”描述为 2026-09-06 的历史状态。
- 提交前已核对备份变更清单中的 88 项均未被后续修改，索引为空，任务分支与本地 development 尚无分叉。只对清单内现存的 48 个 Markdown 文件显式暂存（含被忽略文件），不改变 `.gitignore`，不纳入备份和其他个人文件。
- 原本未跟踪的 40 个生成技能入口已在本地移除，没有对应 Git 删除项；保留的参考与新入口会进入版本控制。其他机器上的未跟踪旧技能不会因本次提交自动删除。
- 发现本地 `.git/hooks/post-commit` 会阻塞执行 GitNexus `analyze --index-only`；保留该已有 hook，不修改或绕过。它不同于已审计的 Claude hooks。
- 文档范围继续采用差异/引用/技能结构证据；本次额外执行提交前 GitNexus staged change detection。提交与合并结果以 Git 历史及本任务最终回执为准。
- 提交前结果：`git diff --cached --check` PASS；48 文件白名单、12 技能结构与常见私钥/token 格式检查 PASS（非全面安全审计）。`gitnexus detect-changes --scope staged --repo cwgsyw-platform` PASS：48 文件、2 个 Markdown 标题符号、0 条受影响执行流程，风险 low。
