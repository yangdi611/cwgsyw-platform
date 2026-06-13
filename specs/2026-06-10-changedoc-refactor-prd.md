# PRD: 重构 changedoc 数据流，降低与 cmdb 的耦合

## 背景

changedoc 模块经历了从单模板到双模板（申请单 + 变更方案）的演进，实体层、前端、导出逻辑存在多处历史残留。前端 ci_selector 组件直接调用 CMDB 模块的 API，导致模块间存在不必要的数据流耦合。本次重构目标是清理技术债务、统一数据模型、解耦前端对 CMDB 的直接依赖。

## 用户故事

- 作为**运维工程师**，我想在创建变更文档时选择申请单模板和方案模板，以便分别管理变更申请和变更方案
- 作为**运维工程师**，我想在变更文档中通过 CI 选择器关联受影响的配置项，以便记录变更影响范围
- 作为**审批人**，我想看到完整的申请单和方案信息，以便做出准确的审批决策
- 作为**系统管理员**，我想独立配置申请单字段和方案字段，以便灵活适应业务需求变化
- 作为**平台开发者**，我希望 changedoc 模块与 cmdb 模块之间通过清晰的接口通信，以便两个模块可以独立演进

## 验收标准

### 1. 清理实体层历史残留

- [ ] ChangeDoc 实体移除 `@Deprecated templateId` 字段
- [ ] ChangeDoc 实体移除冗余单字段（changeDesc, impactScope, changeWindow, resourceSupport, background, steps, riskAssessment, rollbackPlan, verifyMethod, contacts, title），全部统一由 fieldsData (Map) 承载
- [ ] 数据库 migration 脚本保证数据不丢失（旧字段数据合并到 fieldsData）
- [ ] 所有 Mapper/Service 中引用旧字段的代码全部移除或改为从 fieldsData 读取

### 2. 前端对齐双模板模型

- [ ] 前端详情页（`change-docs/[id]/page.tsx`）使用 `applicationFieldConfig` + `planFieldConfig` 分别渲染两组字段，不再使用单一 `fieldConfig`
- [ ] 前端详情页正确显示 `applicationTemplateName` 和 `planTemplateName`
- [ ] 前端新建页（`change-docs/new/page.tsx`）支持同时选择申请单模板和方案模板（两步选择或并列选择）
- [ ] 前端 API 类型定义（ChangeDocVO interface）与后端返回结构完全对齐

### 3. 解耦 ci_selector 与 CMDB

- [ ] 后端 changedoc 模块新增 CI 查询代理接口（如 `GET /api/change-docs/ci/search` 和 `GET /api/change-docs/ci/topology/{id}`），内部调用 cmdb 服务
- [ ] 前端 ci_selector 组件改为调用 changedoc 自身的代理接口，不再直接调用 `/cmdb/*` 端点
- [ ] ci_selector 的 CI 数据格式由 changedoc 模块定义 DTO，不再依赖 cmdb 模块的 DTO 结构
- [ ] CMDB 模块的内部重构不影响 changedoc 的 CI 选择功能

### 4. 导出服务对齐

- [ ] ExportService 的 PDF/Word 导出逻辑从 fieldsData 读取所有字段值，不再引用已删除的实体单字段
- [ ] 双模板场景下导出能正确使用对应的 Word 模板文件（申请单模板 vs 方案模板）
- [ ] 水印、CJK 字体等现有导出功能不受影响

### 5. AI 生成对齐

- [ ] `generateAiContent` 方法的 prompt 构建从 fieldsData 读取变更信息，不再引用已删除的实体字段
- [ ] AI 生成结果写入 fieldsData 对应 key，前端正确显示

### 6. 向后兼容

- [ ] 已有变更文档数据（旧格式）在迁移后可正常查看、导出
- [ ] API 接口路径和权限控制不变（`/api/change-docs/*`）
- [ ] 前端路由不变（`/change-docs`, `/change-docs/new`, `/change-docs/[id]`）

## 交互流

### 新建变更文档

1. 用户进入 `/change-docs/new`
2. 系统展示可用模板列表（区分申请单模板、方案模板）
3. 用户选择申请单模板 → 系统展示申请单字段表单
4. 用户选择方案模板（可选）→ 系统展示方案字段表单
5. 用户填写字段（CI 选择器通过 changedoc 代理接口查询 CMDB）
6. 用户点击"创建" → 系统创建文档，跳转详情页

### 查看/编辑变更文档

1. 用户进入 `/change-docs/[id]`
2. 系统分别展示申请单区域（applicationFieldConfig 字段）和方案区域（planFieldConfig 字段）
3. 草稿状态可编辑，保存后 fieldsData 整体更新
4. 提交后进入审批流程

### CI 选择器（解耦后）

1. 用户点击"添加受影响的 CI"
2. 前端调用 `/api/change-docs/ci/search?keyword=xxx`
3. changedoc 后端代理调用 cmdb 模块，返回 changedoc 自定义 DTO
4. 用户选中 CI 后，前端可选调用 `/api/change-docs/ci/topology/{id}` 获取关联建议
5. 选中的 CI 以 JSON 存入 fieldsData 对应 key

## 非功能性需求

- 性能：CI 搜索代理接口响应时间 < 500ms（与直接调用 CMDB 相当）
- 数据迁移：migration 脚本支持回滚
- 测试：现有单元测试和集成测试通过，新增 CI 代理接口测试覆盖
- 安全：CI 代理接口遵循现有权限控制（`change_doc:read` / `change_doc:update`）

## 不做的事

- 不改变审批流程逻辑（draft → pending → approved/rejected）
- 不引入工作流引擎（当前简单状态机足够）
- 不改变变更编号生成规则（CHG-YYYYMMDD-NNN）
- 不改变模板管理后台（`/admin/change-doc-templates`）

---

## 技术方案与实现计划

> Architect 已完成。详见以下文件：

| 文档 | 路径 | 内容 |
|------|------|------|
| 技术方案 | `.hermes_company/specs/2026-06-10-changedoc-refactor-tech-spec.md` | 架构决策、接口契约、数据模型、数据流图、风险评估 |
| 实现计划 | `.hermes_company/plans/2026-06-10-changedoc-refactor.md` | 5 Phase / 16 Tasks，预计~7h，含依赖关系图和 bite-sized 任务拆解 |

### 核心决策摘要

1. **实体层清理**: 3 阶段渐进删除（migration 先行 → 代码移除 → 列删除）
2. **CI 解耦**: 在 changedoc Controller 新增 2 个代理端点（`/api/change-docs/ci/search`, `/api/change-docs/ci/topology/{id}`）
3. **前端双模板**: 新建页两步选择（申请单模板必选 + 方案模板可选），详情页双区域渲染
4. **导出/AI**: 保持从 fieldsData 读取，无需大幅改动，确认 key 名对齐即可

### 实现顺序: Phase 1 (CI代理) → Phase 2 (双模板前端) → Phase 3 (实体层清理) → Phase 4 (AI对齐) → Phase 5 (回归测试)

