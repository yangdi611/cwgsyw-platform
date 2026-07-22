# 全平台穷尽功能测试执行 Prompt v1.0

## 1. 用途

本文件提供一段可直接交给 Codex 的总执行 Prompt，用于根据本目录测试文档启动一次完整测试，持续执行到覆盖闭环，并生成可指导下一轮系统优化的报告。

推荐在新的 Codex 任务中使用，工作目录必须是：

```text
/Users/byron/AI/cwgsyw-platform
```

测试入口统一使用远端服务器本机地址：

```text
http://localhost
```

不要依赖用户本机或应用内浏览器。Codex 应在服务器上启动独立 Chrome/Playwright 浏览器。

## 2. 使用前准备

启动任务时向 Codex 提供：

1. 下方完整 Prompt。
2. `superadmin` 当前密码，通过对话临时提供，不写入文件。
3. 是否允许实际执行备份恢复。默认不允许实际 restore，只测试创建、下载、权限和确认流程。
4. 是否允许测试外部 SMTP、Prometheus、AI Provider。未提供可用配置时相关用例标记 `BLOCKED`，不能标 PASS。
5. 是否允许在独占测试窗口执行全租户 `Rollback -> Legacy -> Enforced`。默认不允许，只执行状态、预检和负向确认测试。
6. 是否允许使用平台测试账号执行 break-glass API 绕过测试。默认不允许；只有获得明确授权后，才可限定在 runId 资源上执行，并在用例结束立即停用。

已授权事项：

- 除 `superadmin` 外，数据库中的现有账号均为测试账号。
- 允许通过现有管理员功能/API重置这些测试账号密码。
- 允许创建、修改、审批、删除带本次 `runId` 的测试数据。
- 允许查询数据库、日志、Redis 和 MinIO用于结果核验和精确清理。
- 禁止修改 `superadmin` 的密码、旧角色、新 role assignment、membership、主组、状态和资料完成状态。

## 3. 一次性执行总 Prompt

复制以下完整内容到新的 Codex 任务，并在末尾提供 `superadmin` 密码：

```text
你现在要在 /Users/byron/AI/cwgsyw-platform 执行一次“当前版本封闭范围内的全面功能测试”。

目标不是抽样冒烟，而是对当前可枚举的页面、入口、成员关系、功能权限、作用域角色、资源 ACL、授权迁移、操作、状态转换、输入等价类、动态模型、跨模块链路和数据范围规则做到 100% 可审计覆盖，并生成完整报告，作为下一轮系统优化的依据。

一、强制边界

1. 本轮包含功能、统一授权、迁移/切换、状态、输入边界、页面交互、CRUD、导入导出、跨模块和数据一致性测试。
2. 本轮明确排除性能测试、安全渗透测试和故障注入测试。
3. 测试期间不要修改业务代码、不要修复缺陷、不要提交 Git。发现问题只记录证据、根因线索和优化建议。除非我在测试过程中明确要求修复，否则保持“测试与整改分离”。
4. 不得修改 superadmin 的密码、旧角色、新 role assignment、membership、主组、状态、资料完成状态或任何权限。
5. 除 superadmin 外，现有账号都是测试账号，允许通过产品已有管理员接口或 UI 重置密码。优先使用产品功能/API，禁止直接改 password hash 绕过密码历史、会话撤销和审计。
6. 所有测试数据必须带 runId，禁止修改或删除无法确认属于本批次的数据。
7. 所有页面主流程必须从 http://localhost 登录后的首页开始，通过真实 UI 点击进入。直接 URL 和 API 仅用于权限反向测试、动态路由补充验证和数据核验。
8. 浏览器测试必须在远端服务器启动独立 Google Chrome/Playwright，不要依赖用户本机的应用内浏览器。
9. 不要因为任务规模大而提前结束。持续执行、记录检查点并断点续跑，直到满足关闭标准，或明确列出无法自行解除的 BLOCKED 项。
10. 不能把“页面能打开”当成功能通过，不能把 401 当作 403 权限验证，不能把当前数据库没有某状态数据当作不需要测试该状态。
11. 不能用固定角色名或旧 groupId 推断权限。每次授权判定都要记录：有效功能 permission、assignment scope/expiry、资源 owner/group/mode/ACL、祖先 traverse 和 reasonCode。
12. 全租户 Enforce/Rollback、实际 restore、无法精确清理的数据，以及可能影响非测试用户的 break-glass 操作，必须获得明确授权后执行。
13. L4 不得缩小范围。无共享写入、manifest、账号、配置、端口或夹具冲突的只读批次可按模块并行，并使用独立 Playwright output；写入、授权切换、状态机、配置恢复和清理链必须串行。
14. 同一 L4 run 中已有完整证据、清理完成且经后续代码影响分析证明未受影响的 PASS 可以保留。REM 合并后只重跑受影响范围和全部 NOT_RUN；不得继承其他 run、部分覆盖或源码推断为 PASS。

二、必须先完整阅读的文档

按以下顺序完整阅读，不得只读摘要：

1. AGENTS.md
2. CLAUDE.md
3. frontend/AGENTS.md
4. frontend/CLAUDE.md
5. docs/acceptance/full-platform-exhaustive-functional-test-v1.0/README.md
6. docs/acceptance/full-platform-exhaustive-functional-test-v1.0/TEST-SPEC-v1.0.md
7. docs/acceptance/full-platform-exhaustive-functional-test-v1.0/baseline-and-coverage-audit-v1.0.md
8. docs/acceptance/full-platform-exhaustive-functional-test-v1.0/coverage-inventory-v1.0.md
9. docs/acceptance/full-platform-exhaustive-functional-test-v1.0/account-permission-matrix-v1.0.md
10. docs/acceptance/full-platform-exhaustive-functional-test-v1.0/permission-endpoint-matrix-v1.0.md
11. docs/acceptance/full-platform-exhaustive-functional-test-v1.0/functional-test-catalog-v1.0.md
12. docs/acceptance/full-platform-exhaustive-functional-test-v1.0/cross-module-state-matrix-v1.0.md
13. docs/acceptance/full-platform-exhaustive-functional-test-v1.0/test-data-and-cleanup-v1.0.md
14. docs/acceptance/full-platform-exhaustive-functional-test-v1.0/execution-record-template-v1.0.md

历史目录 docs/acceptance/full-platform-quality-audit/ 和 test/ 只能作为补充参考。出现冲突时，以本 v1.0 测试包、当前源码和运行数据库为准。

三、创建本次执行目录

生成：

runId = FQA_YYYYMMDD_HHMM_<branchShort>

创建目录：

docs/acceptance/full-platform-exhaustive-functional-test-v1.0/runs/<runId>/

至少创建以下文件：

1. execution-record.md
2. coverage-summary.md
3. defects.md
4. optimization-backlog.md
5. environment-baseline.md
6. test-data-manifest.json
7. checkpoint.json
8. evidence-index.md

截图、trace、network 和 console 证据保存到：

test-results/<runId>/<caseId>/

test-results 不提交 Git；报告中只保存相对证据路径和摘要。

四、Phase 0：冻结环境并重新生成覆盖分母

1. 记录 branch、commit、git status、development 比较基线、前后端镜像 digest、容器 ID、Flyway schema version、Chrome 版本和开始时间。
2. 确认当前运行栈来自 docker-compose.dev.yml。
3. 检查运行镜像是否包含当前工作区。若不一致，重新构建并仅替换 backend/frontend，使用 --no-deps；PostgreSQL、Redis、MinIO、Nginx 不得重启。
4. 按 baseline-and-coverage-audit-v1.0.md 重新提取：
   - 全部前端 page 路由；
   - 全部后端 Mapping；
   - 全部 permission resource/action；
   - 全部 permission 的 runtime consumer 分类、endpoint/method、间接 symbol/alias、实际 guard 和 disposition；
   - 全部有效账号、旧角色关系、membership/primary group、功能角色、role assignment/scope/expiry；
   - configured/effective authorization mode、cutover status/epoch、account rollout、migration exceptions 和 Shadow decision diff；
   - Wiki/共享文件 owner/group/mode/accessVersion、resource ACL 和父链；
   - 全部 CMDB 模型和属性类型；
   - 全部变更模板字段类型；
   - 全部表单、mutation、下载和上传入口；
   - 全部业务状态值。
5. 将实时分母与文档比较。若有漂移，先更新本次 run 目录里的覆盖清单，不要直接假设旧文档仍完整。
6. 创建数据库逻辑备份和执行前数据计数快照。不要执行 restore。
7. 保存非测试账号、membership、assignment、内置/非测试角色和非测试资源 ACL 的原始状态，以便最终恢复核对。
8. 先报告实时分母；当前文档快照为 71 页面、300 Mapping、26 资源、98 action、15 用户、6 角色、74 个表单/mutation/写 API 文件（主扫描 56 个，补充扫描新增 18 个）。任何一项漂移都以实时提取为准。

五、Phase 1：按安全顺序准备账号和测试数据

1. 使用 superadmin 仅完成环境基准和管理员操作，不修改该账号。
2. 在创建或修改任何测试用户、旧角色、membership、role assignment 或授权资源前，先处理 `AUTHZ-010`：若已获得独占窗口与明确授权，将它作为唯一提前执行的 B2 用例完成 `Enforced -> ROLLBACK -> preflight -> ENFORCE`，核对最终恢复 Enforced 且 epoch 仅因再次 Enforce 增加 1；若未获授权则立即记为 `BLOCKED` 并保持状态不变。不得先创建 manual assignment 再做 preflight。
3. `AUTHZ-010` 完成或被标记 `BLOCKED` 后，才可通过现有管理员重置密码功能为测试账号设置本批次临时密码。密码只保存在当前任务内存或受控环境变量，不写入报告和命令输出。
4. 对必须首次登录改密的账号完成 requiredActions 流程，并记录该行为。
5. 当前 enforced 快照中除 superadmin 外既有账号没有有效新 assignment。此时才为所有允许路径准备 runId 功能角色和 tenant/group assignment；未准备完成前，命名账号只能用于拒绝路径，不能据旧角色名判 PASS。
6. 若已明确授权正向 break-glass 测试，通过现有用户创建 UI/API 创建无组临时账号 `fqa_platform_<runId>`，通过产品的旧角色兼容入口授予内置 `super_admin`，核对系统生成有效 `super_admin@platform` compatibility assignment，再完成首次登录并验证独立 platform session。公共 role-assignment 新增接口只支持 tenant/group，不得用它或直接 SQL 伪造 platform assignment。若产品入口无法建立该账号，`AUTHZ-011/013/014/015` 标记 `BLOCKED`；`acltest` 只能执行非 platform 负向对照。
7. 通过产品 UI 创建临时最小权限角色 fqa_no_write_<runId> 和账号 fqa_viewer_<runId>；通过组管理或迁移工作台建立管理组 member/primary，再创建 group assignment。角色只赋予明确 read 权限，用于实时 permission action 的反向矩阵。
8. 通过用户“授权”弹窗构造非主组 membership、leader/member 和 tenant/group assignment；主组只通过组管理或迁移工作台建立/修正。`validUntil` 目前用 API 验证，UI 不要求存在有效期控件。不得直接写授权关系表。
9. 为作用域拒绝和 ACL 拒绝使用不同夹具：前者有功能 permission 但 scope 不覆盖，后者 permission/scope 均满足而资源 ACL 或祖先 x 拒绝。
10. 按 test-data-and-cleanup-v1.0.md 建立测试数据 manifest；每个创建对象成功后立即登记，不能事后补记。
11. 准备文件、CSV、JSON、NDJSON、BPMN 等测试夹具。

六、Phase 2 至 Phase 8：执行全面测试

除 Phase 1 按安全顺序提前处理 `AUTHZ-010` 外，严格按 TEST-SPEC-v1.0.md 的 B1-B8 顺序执行：

B1 认证、首页、导航、实时页面分母和全部只读行为
B2 用户、membership、功能角色、scope assignment、迁移工作台、break-glass、资料、密码、会话
B3 CMDB、设备、IPAM
B4 共享文件、Wiki
B5 运维日历、日报、Workflow
B6 变更文档、模板、审批、导出
B7 报表、通知、系统配置、AI、审计、备份
B8 跨组、跨 scope、资源 ACL、授权模式、跨模块、边界输入、重复提交和清理

执行要求：

1. 自动统计并执行 functional-test-catalog-v1.0.md 中全部唯一主功能用例；当前快照为 275 个 ID，不以旧数量作为关闭依据。
2. 自动统计并执行 cross-module-state-matrix-v1.0.md 中全部唯一状态/跨模块用例；当前快照为 78 个 ID。
3. coverage-inventory-v1.0.md 中全部实时页面执行；当前快照为 71 个页面。
4. 当前数据库每个 permission action 都必须先分类为 `DIRECT_ENDPOINT / INDIRECT_SERVICE / INTERNAL_SYSTEM / COMPATIBILITY_ALIAS / MISSING_CONSUMER / GUARD_DRIFT`，记录 endpoint/method、间接 symbol 或 alias、实际 guard 和 disposition。可由用户触发的 action 展开 allow/deny；内部动作按真实系统触发验证；missing/drift 立即绑定缺陷并判 `FAIL`，禁止用 `N/A` 或复制其他 permission 的结果凑齐分母。当前快照为 98 个 action，执行时以实时数量为准。
5. 当前每个 CMDB 模型至少执行列表、创建、详情和字段显示检查。
6. 当前每个 CMDB 属性类型和变更模板字段类型都执行合法值、非法值、编辑、刷新和显示检查。
7. 每个表单字段按类型展开等价类和边界值，不得把多个输入合并成一次结果。
8. 每个业务状态机执行所有合法边和所有非法边。
9. 每个 CRUD 对象执行创建、列表、详情、编辑、刷新、删除取消、删除确认、删除后访问、审计和清理闭环。
10. 每个权限测试同时检查 UI、直接路由、直接 API 和数据库无变化；统一业务裁决返回细分 reasonCode 时精确断言，通用 AccessDenied 只按实际 403 合同留证。分别构造无功能权限、scope 不覆盖、assignment 过期、资源 ACL 拒绝和祖先 traverse 拒绝。
11. 每个稳定页面检查 Console error、失败请求和后端日志。
12. 每个下载验证按钮、HTTP 状态、Content-Disposition、建议文件名、MIME 和非空内容。
13. 每个上传验证预览、进度、完成、错误、取消、数据库和 MinIO。
14. 每个 FAIL 立即写入 defects.md，不要等全部测试结束。
15. 每完成一个用例立即更新 execution-record.md 和 checkpoint.json。
16. Wiki/共享文件分别覆盖 owner、named user、matched groups 按位并集、others、access/default ACL、setgid/default 继承、祖先 x 和 accessVersion 409。
17. 授权工作台覆盖预检、账户/资源回填幂等、异常 resolved/acceptedLegacy、失效关系清理、legacy role ACL 转换、Enforce/Rollback 门禁和审计。
18. break-glass 当前没有 UI，只测 API；仅使用已验证的 platform 有效 session，理由 10–500、session 隔离、TTL/停用和不可绕过的拒绝类型全部执行。当前唯一产品可达 platform 身份为有效 `super_admin`，其正式 ACL 直通不得误报为 break-glass bypass；实际 ACL/traverse bypass 子场景记有依据的 `N/A`。TTL 自动到期只核对精确 Redis key 消失，不期待系统生成自动到期审计；审计核对 activate 和主动 deactivate，只有未来存在非直通 platform 身份并真实触发 bypass 时才要求 bypass 审计。

七、用例结果规则

每条用例只能是：

PASS：全部预期成立且证据完整
FAIL：任何预期不成立，必须绑定缺陷
BLOCKED：环境或外部条件阻塞，必须写解除条件
N/A：当前版本明确不存在或产品合同明确不适用，必须有源码/产品证据

`N/A` 只表示已审计且合同明确不适用；可分配 permission 没有运行时 consumer、endpoint 缺失、实际 guard 漂移、仅认证未鉴权或测试夹具未准备均不得标 `N/A`。前三类判 `FAIL`，夹具或外部条件阻塞判 `BLOCKED`。

禁止：

- 留空；
- 用“看起来正常”替代证据；
- 因时间不足标 N/A；
- 因当前数据库无数据标 PASS；
- 因后端返回 403 就跳过 UI 检查；
- 因 UI 隐藏按钮就跳过 API 反向验证。

八、发现缺陷时

1. 保留首次失败截图、trace、Console、Network、请求/响应摘要、数据库状态和日志。
2. 只做最小只读诊断，定位可能文件、组件、Controller、Service 和根因类别。
3. 遵守 GitNexus 规则：分析代码影响时先 query/context/impact；不要编辑代码。
4. 缺陷记录必须包含：严重度、用户影响、复现路径、账号、membership/primary group、assignment scope/expiry、authorization mode/rollout、资源 ACL/祖先链、reasonCode、输入、预期、实际、证据、数据污染、临时规避、根因假设、可能修复范围和回归用例。
5. 同根因缺陷建立 defect cluster，但每个独立用户表现仍保留用例结果。

九、断点续跑和“一次性完成”

“一次性完成”表示同一任务持续推进到测试关闭，不表示把所有工作塞进一次浏览器会话。

1. checkpoint.json 至少记录：当前 phase、最后完成 caseId、各状态计数、活动测试对象、当前登录账号、authorization mode/cutover epoch、活动 break-glass、待恢复 ACL/assignment/membership、开放缺陷和 BLOCKED 项。
2. 每 20 个用例或每完成一个模块刷新 checkpoint。
3. Codex 上下文压缩、浏览器重启或容器会话变化后，从 checkpoint 继续，不能重头执行或漏项。
4. 若用户发“继续”，先读取 checkpoint 和最新 execution-record，再继续下一个 NOT_RUN/BLOCKED 项。
5. 未达到关闭条件时，不得给出“测试完成”的结论。

十、Phase 9：清理和恢复

1. 按 test-data-and-cleanup-v1.0.md 依赖逆序清理所有 runId 对象。
2. 先撤销临时 role assignment 和 membership，再删除临时 viewer 用户和角色。临时 platform 账号必须先停用其 break-glass、确认未持有资源，再通过产品用户删除入口清理；不得尝试从通用 assignment 入口撤销受保护的 `super_admin`。
3. 恢复测试账号原 status、旧 roles、memberships、primary group 和 assignments；保留本批次密码还是再次随机化，按测试环境策略记录。
4. 精确清理本批次浏览器会话，不执行全局 session 清空。
5. 清理 MinIO 测试对象。
6. 恢复非测试资源 owner/group/mode/ACL，确认 accessVersion 和继承关系符合预期。
7. 主动停用当前 session 的 break-glass，确认无活动测试 key；保留审计证据。
8. 确认 superadmin 全字段与前快照一致。
9. 确认非测试角色 permission 集合与前快照一致。
10. 确认 cutover/rollout 符合获批状态路径；未授权切换时必须与前快照完全一致。
11. 确认 manifest active objects=0、FQA 有效对象=0、FQA session=0、FQA MinIO objects=0。

十一、生成最终报告

必须在 run 目录生成：

1. FINAL-TEST-REPORT.md
2. OPTIMIZATION-GUIDE.md

FINAL-TEST-REPORT.md 必须包含：

- 环境和测试基线；
- 实际覆盖分母；
- 页面、permission allow/deny、assignment scope/expiry、resource ACL/祖先链、授权迁移状态边、操作、状态边、输入类、链路、上传下载、清理各自覆盖率；
- PASS/FAIL/BLOCKED/N/A 数量；
- P0/P1/P2/P3 缺陷列表；
- 未解释 Console error、HTTP 5xx 和后端异常；
- 测试数据清理结果；
- 最终结论 PASS/FAIL/INCOMPLETE；
- 不能被“总体通过率”掩盖的关键风险。

OPTIMIZATION-GUIDE.md 必须面向下一轮优化，包含：

1. 缺陷按根因聚类，而不只是按页面罗列。
2. 每个聚类的用户影响、涉及模块、代码位置、数据风险和回归范围。
3. 优先级建议：P0 立即修复、P1 当前迭代、P2 后续迭代、P3 体验优化。
4. 推荐拆分成哪些独立 SPEC，避免一个超大整改任务。
5. 每个建议 SPEC 的范围、非目标、依赖、验收条件、回滚和必须保留的回归用例。
6. 测试资产改进建议：哪些用例应自动化、哪些控件需要稳定 data-testid、哪些 API/数据库核验需要脚本。
7. 架构层面的重复根因，例如权限合同漂移、前后端 DTO 不一致、状态机分散、错误处理分散、下载文件名编码、表单校验缺失。
8. 不直接修改代码，只提供可执行优化路线。

十二、关闭标准

只有同时满足以下条件才能宣布完成：

1. 页面覆盖率 100%。
2. 全部实时 permission 的消费分类完成；可由用户触发的权限 allow/deny 覆盖率 100%，`MISSING_CONSUMER/GUARD_DRIFT` 未解释项为 0。
3. assignment scope/expiry 覆盖率 100%。
4. resource ACL/祖先链覆盖率 100%。
5. 授权迁移状态边全部 PASS；未获批的全租户切换允许保留明确 BLOCKED，但最终结论必须是 INCOMPLETE。
6. UI 操作覆盖率 100%。
7. 状态合法边和非法边覆盖率 100%。
8. 输入等价类覆盖率 100%。
9. 跨模块链路覆盖率 100%。
10. 上传下载覆盖率 100%。
11. 测试数据清理完成率 100%。
12. NOT_RUN=0；除未授权高风险状态边外 BLOCKED=0。
13. P0/P1=0；P2/P3 有明确接受结论。
14. 未解释 Console error=0，未解释 HTTP 5xx=0。
15. superadmin、非测试授权和资源 ACL 未被改变。

如果无法满足，最终结论必须是 FAIL 或 INCOMPLETE，并准确列出缺口，不得声称全面测试完成。

十三、沟通要求

1. 开始时先报告实时覆盖分母和执行计划。
2. 每完成一个批次给简短进度：完成数、失败数、阻塞数、关键缺陷、剩余范围。
3. 不频繁询问可从源码、数据库或页面自行确定的问题。
4. 涉及实际 restore、全租户 Enforce/Rollback、无法清理的数据或可能影响非测试用户的 break-glass 时，暂停并请求确认。
5. 最终回复只总结结论、报告路径、关键缺陷和下一步优化入口，不复制整份报告。

现在开始执行。先完整阅读规则和十一份主测试文档，然后执行 Phase 0。不要停在计划阶段。

superadmin 密码由我在本任务下一条消息中提供，不得写入文件或输出。
```

## 4. 密码补充消息

发送总 Prompt 后，再单独发送：

```text
superadmin 当前密码是：<当前密码>
```

不要把密码直接拼进总 Prompt、文档或执行报告。

## 5. 中断后的继续 Prompt

正常情况下总 Prompt 要求 Codex自行持续执行。若任务被手动中断或换到新的 Codex 任务，使用：

```text
继续执行全平台封闭范围穷尽功能测试。

工作目录：/Users/byron/AI/cwgsyw-platform
测试包：docs/acceptance/full-platform-exhaustive-functional-test-v1.0/
runId：<runId>

先读取：
1. runs/<runId>/checkpoint.json
2. runs/<runId>/execution-record.md
3. runs/<runId>/coverage-summary.md
4. runs/<runId>/defects.md
5. runs/<runId>/test-data-manifest.json

核对当前代码、容器、数据库 schema 和账号权限是否仍与 environment-baseline.md 一致。如果发生漂移，先报告并更新受影响分母；没有漂移则从 checkpoint 中第一个 NOT_RUN 或可解除的 BLOCKED 用例继续。

继续遵守 EXECUTION-PROMPT-v1.0.md 的全部边界：不修改业务代码、不修改 superadmin、所有测试数据带 runId、持续更新证据和报告，直到关闭标准满足或明确无法解除的阻塞出现。
```

## 6. 最终报告用于下一轮优化的方法

测试结束后，建议新开一个“整改规划”任务，输入：

```text
请根据以下测试结果编写下一轮系统优化计划，不要直接修改代码：

1. <run目录>/FINAL-TEST-REPORT.md
2. <run目录>/OPTIMIZATION-GUIDE.md
3. <run目录>/defects.md
4. <run目录>/coverage-summary.md

要求：
- 对照 development 分支和当前工作区验证每个缺陷。
- 按共同根因聚类，不按页面机械拆分。
- 将 P0/P1 与普通质量债分开。
- 拆成小型、可独立验证和回滚的 SPEC。
- 每个 SPEC 写明范围、非目标、接口/权限/数据合同、实施步骤、验证命令、浏览器回归用例和回滚策略。
- 不把性能、安全、故障注入纳入本轮，除非测试报告表明它们已成为功能阻塞。
- 先输出建议 SPEC 清单和依赖顺序，等确认后再写实际文档。
```

这样可以保持“测试发现问题”和“实施整改”两个阶段独立，避免测试过程中修改代码导致后续覆盖基线失效。

## 7. 预期最终目录

```text
docs/acceptance/full-platform-exhaustive-functional-test-v1.0/
  EXECUTION-PROMPT-v1.0.md
  runs/
    <runId>/
      environment-baseline.md
      execution-record.md
      coverage-summary.md
      defects.md
      optimization-backlog.md
      test-data-manifest.json
      checkpoint.json
      evidence-index.md
      FINAL-TEST-REPORT.md
      OPTIMIZATION-GUIDE.md
```

报告目录也受仓库 `docs/*` 忽略规则影响。需要提交时使用 `git add -f`，证据目录 `test-results/` 默认不要提交。
