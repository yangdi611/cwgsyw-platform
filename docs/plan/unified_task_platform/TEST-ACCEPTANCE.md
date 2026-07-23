# 统一任务平台测试与验收计划

**状态：** 执行中  
**目标：** 验证产品行为、权限、数据一致性、失败零副作用和旧实现清理

---

## 1. 测试层级

| 层级 | 内容 | 运行频率 |
| --- | --- | --- |
| L1 | 单元测试：字段、公式、状态机、调度、范围解析 | 每个工作包 |
| L2 | 后端集成：PostgreSQL/Flowable/MinIO 边界 | 每个后端切片 |
| L3 | API 契约与前端组件/类型检查 | 每个前后端切片 |
| L4 | 关键用户链路 UI/E2E | 工作包 DoD |
| L5 | 全量构建、回归、增量升级/全新安装和旧残留审计 | 最终验收 |

---

## 2. 标准质量命令

从最小相关测试开始，再运行广泛检查。

### 后端

```bash
cd backend && mvn -q -DskipTests compile
cd backend && mvn -q -Dtest='相关测试类' test
cd backend && mvn test
```

项目编译 release 为 Java 21。若本机 JDK 与 Mockito/Byte Buddy 不兼容，使用项目认可的 Java 21 容器或环境，并记录实际命令；不能用错误 JDK 的失败代替代码结论。

### 前端

```bash
cd frontend && npm run lint
cd frontend && npm run typecheck
cd frontend && npm run build
```

### GitNexus

```text
编辑每个 symbol 前：impact(direction=upstream)
阶段结束：detect_changes(scope=all)
最终：detect_changes(scope=compare, base_ref=master)
```

---

## 3. Schema 验收矩阵

| ID | 场景 | 预期 |
| --- | --- | --- |
| DB-001 | V1-V79 既有 PostgreSQL 执行 V80+ | 全部成功，无 repair，非目标哨兵数据不变 |
| DB-002 | WP-09 后查询旧日报/ops task 表 | 0 个 |
| DB-003 | 查询新任务核心表 | 全部存在 |
| DB-004 | 重复 occurrence 插入 | 唯一约束拒绝 |
| DB-005 | 同任务重复 submission version | 唯一约束拒绝 |
| DB-006 | 跨租户 FK/服务引用 | 拒绝且零副作用 |
| DB-007 | 旧 `daily_report:*`/`ops_calendar:*` 权限 | 不存在 |
| DB-008 | 新权限种子 | 角色矩阵符合 SPEC |
| DB-009 | V1 到 latest 全新安装 | 内置模板/审批方案存在且与升级终态一致 |
| DB-010 | 表/列/索引/触发器/函数/配置/权限全量台账 | 每个保留对象有消费者证据，无孤儿对象 |
| DB-011 | `IMPLEMENT_OR_DROP` 新对象 | 均有正式读写/展示/验收链路，否则不存在 |

**已验证（2026-07-23）：** `UnifiedTaskFreshInstallMigrationTest` 在隔离 PostgreSQL 16 空库一次性执行 V1-V108；`UnifiedTaskIncrementalMigrationTest` 从 V79 升级至 V108。两条路径均验证统一任务表、内置模板、日报计划、新权限、旧日报/旧运维任务/过渡授权对象删除，以及 V99-V108 字段级清理与关键索引。

---

## 4. 模板与表单验收

| ID | 场景 | 预期 |
| --- | --- | --- |
| FORM-001 | 创建文本/数字/选项/表格/附件/CI 模板 | 保存和预览一致 |
| FORM-002 | 发布模板 | 生成不可变版本 |
| FORM-003 | 修改 published 版本 | 409，无写入 |
| FORM-004 | 创建下一草稿版本 | 旧版本不变 |
| FORM-005 | 条件显示/条件必填 | 前后端一致 |
| FORM-006 | 公式正常计算 | 前端预览与后端一致 |
| FORM-007 | 循环公式/字段引用不存在 | 发布失败，可读错误 |
| FORM-008 | 除零/精度/范围 | 按配置稳定处理 |
| FORM-009 | 表格列/行校验 | 错误定位到行列 |
| FORM-010 | 敏感字段 | 无权角色不见、不导出、不建全文事实 |

---

## 5. 计划、调度与 CI 验收

| ID | 场景 | 预期 |
| --- | --- | --- |
| PLAN-001 | 一次性计划 | 仅生成一次 |
| PLAN-002 | 每日/周/月/季度 | occurrence 正确 |
| PLAN-003 | 节假日跳过/提前/顺延 | 日期正确 |
| PLAN-004 | per_user | 每人独立任务 |
| PLAN-005 | per_group/shared | 参与关系正确 |
| PLAN-006 | 并发 Scheduler | 不重复任务/通知 |
| PLAN-007 | 暂停计划 | 不生成新任务，旧任务不取消 |
| PLAN-008 | 计划升级模板 | 仅未来 occurrence 使用新版本 |
| CI-001 | 模型组/模型/实例混合选 | 自动去重 |
| CI-002 | 数据库组 + MySQL + 单 CI | 上级覆盖提示正确 |
| CI-003 | 限定 MySQL 后执行人选择 | 不显示范围外 CI |
| CI-004 | 执行人无某 CI 权限 | 不可见不可选择 |
| CI-005 | 新增 MySQL CI | 仅未来任务范围增加 |
| CI-006 | CI 改名/移动组/删除 | 历史快照不变 |
| CI-007 | 大范围 | 预览、二次确认、硬上限生效 |

---

## 6. 任务执行与提交验收

| ID | 场景 | 预期 |
| --- | --- | --- |
| TASK-001 | 待执行列表 | 只显示授权任务 |
| TASK-002 | 自动保存草稿 | revision 递增 |
| TASK-003 | 旧 revision 覆盖 | 409，无丢失 |
| TASK-004 | 必填/附件/表格校验 | 提交失败，草稿保留 |
| TASK-005 | 无审批提交 | submission v1 + completed |
| TASK-006 | 双击/重试提交 | 单一版本、单一事件 |
| TASK-007 | 存储或流程启动失败 | 任务/提交/通知零半写 |
| TASK-008 | 取消/异常关闭 | 状态和 action gate 正确 |
| TASK-009 | 非负责人/非协作人编辑 | 403 |
| TASK-010 | 跨租户猜 ID | 不泄露对象 |
| TASK-011 | 历史 submission | 不可修改，可回溯 |

---

## 7. 审批闭环验收

| ID | 场景 | 预期 |
| --- | --- | --- |
| APP-001 | 需要审批提交 | task submitted + round in_review |
| APP-002 | 指定人审批 | 只有指定人可处理 |
| APP-003 | 候选组审批 | 真实候选成员可处理 |
| APP-004 | 仅有 workflow 权限但非候选人 | 拒绝 |
| APP-005 | 候选人但无业务审批权限 | 拒绝 |
| APP-006 | 退回无理由 | 400 |
| APP-007 | 字段/附件意见 | 引用合法并展示在对应位置 |
| APP-008 | 退回执行人 | changes_requested + 通知 |
| APP-009 | 重新提交 | submission v2 + round 2，v1 保留 |
| APP-010 | 最终通过 | completed + approved + 事实生效 |
| APP-011 | 重复 Flowable 回调 | 幂等，无重复通知/事实 |
| APP-012 | 终止 | 按方案允许，终态正确 |

---

## 8. 日历与日报验收

| ID | 场景 | 预期 |
| --- | --- | --- |
| CAL-001 | 月/周/列表切换 | 同页面，不拆路由 |
| CAL-002 | 筛选后切视图 | 筛选保留 |
| CAL-003 | 点击 task item | 进入 `/tasks/{id}` |
| CAL-004 | 排班/节假日图层 | 类型明确、权限正确 |
| CAL-005 | 快速创建 | 使用统一 one-off task |
| DAILY-001 | 工作日生成日报 | 每人一份、幂等 |
| DAILY-002 | 日报完整字段 | 事项/问题/计划/工时/CI/附件 |
| DAILY-003 | 日报审批退回重提 | 使用通用审批闭环 |
| DAILY-004 | 首页日报快捷入口 | 指向统一任务，不进 `/daily` |
| DAILY-005 | 组级审批方案 | 各组按计划固化方案 |

---

## 9. 统计验收

| ID | 场景 | 预期 |
| --- | --- | --- |
| STAT-001 | 数字 sum/avg/min/max | 结果正确 |
| STAT-002 | 加权平均/比率 | 使用分子分母，不平均平均值 |
| STAT-003 | 单选/多选/布尔 | 分类数量和占比正确 |
| STAT-004 | 表格行数字/分类 | 可聚合可下钻 |
| STAT-005 | 文字字段 | 明细/搜索/标签，无数学聚合 |
| STAT-006 | 附件字段 | 数量/类型/图片墙，下载二次鉴权 |
| STAT-007 | 时间/人员/组/CI 维度 | 使用历史快照 |
| STAT-008 | 审批中/退回版本 | 默认不进正式统计 |
| STAT-009 | 审批通过 | 事实幂等激活 |
| STAT-010 | 新版本替代旧版本 | 不重复计数 |
| STAT-011 | 图表下钻 | 定位原 task/submission/field |
| STAT-012 | 看板共享 | 按当前查看人权限过滤 |
| STAT-013 | 查询超限 | 422，可读原因 |
| STAT-014 | Excel/CSV 导出 | 口径、时间、权限正确 |

### 9.1 跨周期与自动化

| ID | 场景 | 预期 |
| --- | --- | --- |
| ROLLUP-001 | 日报字段绑定统一指标 | 类型/单位/口径校验通过 |
| ROLLUP-002 | 不兼容字段绑定 | 400/422，无写入 |
| ROLLUP-003 | 日报自动汇总到周报 | 系统值正确且可追溯来源 |
| ROLLUP-004 | 周报人工值与系统值 | 分开保存并显示差异 |
| ROLLUP-005 | 统计日报与周报 | 权威来源防止重复累计 |
| ROLLUP-006 | 季报独立指标 | 不强制映射日报字段 |
| GOAL-001 | 组/月度目标 | 完成率正确 |
| GOAL-002 | 越高/越低越好阈值 | 边界触发正确 |
| AUTO-001 | 严重问题触发整改任务 | 正式任务生成并继承关联 |
| AUTO-002 | 相同来源事件重放 | 只生成一条整改任务 |
| AUTO-003 | 整改完成生成复查 | 链路正确、无循环 |
| AUTO-004 | 自动化失败 | 可重试，不回滚来源任务 |
| AUTO-005 | 无权模板/执行范围 | 规则激活或执行拒绝 |
| SUBSCRIBE-001 | 看板定时发送 | 按接收人权限渲染 |
| SUBSCRIBE-002 | 低权限接收人 | 不泄露明细/附件 |

---

## 10. 通知与审计验收

| ID | 场景 | 预期 |
| --- | --- | --- |
| NOTIFY-001 | 任务生成/截止/逾期 | 正确接收人 |
| NOTIFY-002 | 重复事件 | 幂等一次 |
| NOTIFY-003 | 退回/通过 | 执行人收到并跳正式页面 |
| NOTIFY-004 | 发送失败 | 可重试，不回滚业务主事务 |
| AUDIT-001 | 模板/计划管理动作 | audit log 完整 |
| AUDIT-002 | 提交/审批/下载 | 业务时间线和审计完整 |
| AUDIT-003 | 敏感内容 | 日志不记录表单全文/附件正文 |

---

## 11. 旧实现清理验收

### 11.1 源码搜索

最终应无运行时代码命中（文档和 Git 历史除外）：

```text
/api/daily-reports
/daily/new
DailyReportController
DailyReportService
DailyReportWorkflowAdapter
daily_report_process_definition_id

/api/ops-calendar/tasks
/api/ops-calendar/rules
/api/ops-calendar/templates
/api/ops-calendar/stats
/api/ops-calendar/report-materials
OpsScheduleTask
OpsScheduleRule
OpsScheduleTemplate

/api/workflow/tasks/my
/api/workflow/tasks/group
/api/workflow/approve
/api/workflow/center/tasks
/workflow/todo
/workflow/tasks
```

允许保留“日报”“运维日历”等用户可读名称，但不能保留旧技术路径和领域类。

### 11.2 运行时

- 旧 HTTP 路由返回 404，而不是 200 重定向或兼容响应。
- 侧边栏、面包屑、通知、首页、CMDB、报表没有旧链接。
- OpenAPI/route map（如有）无旧路由。
- WP-09 后的升级库和全新安装库都无旧表、旧专属触发器/函数、权限、配置和 seed。
- 共享 workflow/notification/audit/config 表只删除目标行，非目标哨兵数据不减少。

### 11.3 旧任务域 schema 零垃圾

| ID | 场景 | 预期 |
| --- | --- | --- |
| CLEAN-001 | 枚举本次清理范围内的表和列 | 每项均能关联旧任务替代/`KEEP` 证据或已在清理 migration 删除，无 `AUDIT_REQUIRED` |
| CLEAN-002 | 过渡/迁移/影子对象 | `TRANSITIONAL_REVIEW` 为零；若转 `KEEP`，具备正式管理/查询入口和验收用例 |
| CLEAN-003 | 重复 RBAC/ACL 模型 | 只有一个终态权威来源，旧表、旧列、兼容 Mapper/Service 和双读全部删除 |
| CLEAN-004 | 旧任务域零消费者表列 | 最终 schema 不存在；本项不适用于用户、RBAC、CMDB、设备、Wiki、共享文件、通知等其他正式业务模块 |
| CLEAN-005 | 索引/约束/触发器/函数 | 每项保护真实查询或不变量，无悬空、重复和旧目标依赖 |
| CLEAN-006 | V79 升级与 V1 全新安装 | 终态对象集合、关键约束和种子一致，迁移后非垃圾业务数据完整 |
| CLEAN-007 | 本次清理范围的表级 `KEEP` 对象逐列复核 | 每列均有独立终态证据，不存在因表保留而“随表保留”的旧任务历史列 |

---

## 12. 非功能验收

### 性能

- 我的工作典型首屏 ≤ 2 秒。
- 普通任务详情 ≤ 2 秒。
- 常用看板典型首屏 ≤ 3 秒。
- CI 目录按需加载，无全量实例一次拉取。
- 调度批量生成不锁住整租户长事务。

### 安全

- tenant 强制过滤。
- 组范围和参与关系生效。
- 统计与附件不旁路权限。
- 条件/公式不执行任意代码。
- 富文本输出经过安全清洗。

### 可用性

- 自动保存失败明确显示。
- 调度、通知、回调和事实提取可重试/巡检。
- 空、加载、错误、无权限状态完整。

---

## 13. 证据要求

每个工作包在 `IMPLEMENTATION-STATUS.md` 记录：

- 运行命令和结果。
- 相关测试类/用例。
- UI 截图或自动化证据路径（如产生）。
- GitNexus impact 与 detect_changes 摘要。
- 已清理测试数据和方式。
- 失败是否为既有问题及证据。

禁止以“代码看起来正确”替代可执行验证。

---

## 14. 最终签收门槛

- 所有 P0/P1 场景通过。
- 定向和全量后端测试通过。
- 前端 lint、typecheck、build 通过或只有明确无关既有警告。
- V79 增量升级、V1 全新安装和健康检查通过，终态一致。
- 旧实现清理为零残留。
- 旧任务域、关联共享目标行和明确过渡模型均有去留证据；其他正式业务模块对象未被本项目删除或改动。
- 权限、失败零副作用、并发幂等和审计证据齐全。
- PRD 的 AC-001 至 AC-015 均有对应证据。
