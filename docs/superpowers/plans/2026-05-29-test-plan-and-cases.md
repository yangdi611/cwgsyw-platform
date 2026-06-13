# 全面精细化浏览器测试方案与用例 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 cwgsyw-platform 全部 10 个模块创建完整手工测试套件，包含测试方案和 ~126 条测试用例，均输出到 `test/` 目录。

**Architecture:** 纯文档输出，不涉及代码。按模块组织测试用例，每模块独立章节，P0 写到操作步骤级，P1/P2 写到场景级。

**Tech Stack:** Markdown

**Source spec:** `docs/superpowers/specs/2026-05-29-test-plan-and-cases-design.md`

---

### Task 1: test/README.md + fixtures/

**Files:**
- Create: `test/README.md`
- Create: `test/fixtures/.gitkeep`

- [ ] **Step 1: 写出 test/README.md 目录说明**

内容：
- 目录结构树
- 两个文档的说明和阅读顺序
- 测试账号信息（简要，详细在方案中）
- 环境要求（Docker Compose 启动）

- [ ] **Step 2: 创建 fixtures 目录**

```bash
mkdir -p test/fixtures
touch test/fixtures/.gitkeep
```

- [ ] **Step 3: 提交**

```bash
git add test/README.md test/fixtures/.gitkeep
git commit -m "docs: add test directory README and fixtures placeholder"
```

---

### Task 2: test/测试方案.md — 测试目标、环境、账号

**Files:**
- Create: `test/测试方案.md`

- [ ] **Step 1: 写出测试方案前半部分**

章节内容：
1. **测试目标与范围** — 列出 10 个模块名，说明覆盖正常流程/异常边界/权限隔离/UI交互四个维度
2. **测试环境** — 本地 docker-compose，列出 6 个容器、端口、启动命令 `docker compose up -d`，访问地址 `http://localhost:3000`
3. **测试账号矩阵** — 表格，5 行 × 列：角色代码 | 角色名 | 用户名 | 密码 | groupScope | 权限要点

账号数据：

| 角色 | 用户名 | 密码 | 说明 |
|------|--------|------|------|
| super_admin | superadmin | Admin@123 | 全平台 |
| admin | admin | TBD | 租户级 |
| group_leader | leader1 | TBD | 组1 组长 |
| member | member1 | TBD | 组1 组员 |
| viewer | viewer1 | TBD | 只读 |

- [ ] **Step 2: 提交**

```bash
git add test/测试方案.md
git commit -m "docs: add test plan part 1 — objectives, environment, accounts"
```

---

### Task 3: test/测试方案.md — 覆盖矩阵、流程、追踪、报告

**Files:**
- Modify: `test/测试方案.md` (append)

- [ ] **Step 1: 写出测试方案后半部分**

章节内容：
4. **模块覆盖矩阵** — 表格：12 行(模块+合计) × 5 列(模块名 | 正常流程 | 异常边界 | 权限隔离 | UI交互)，每格 ✅/☐
5. **测试优先级定义** — P0 阻塞(核心流程不可用) / P1 严重(功能异常但可绕过) / P2 一般(体验问题) / P3 建议(优化建议)
6. **测试执行流程** — 编号步骤：1) 确认环境已启动 2) 领取模块 3) 切换测试账号 4) 按用例 ID 顺序执行 5) 记录实际结果 6) 发现差异标记失败 7) 汇总到测试报告
7. **缺陷追踪** — 在 GitHub Issues 提 bug，标签 `bug`，assign 开发者，关联测试用例 ID，必填字段：标题/复现步骤/预期/实际/截图/环境信息
8. **测试报告模板** — Markdown 模板：

```markdown
## 测试报告 — YYYY-MM-DD

| 模块 | 总数 | 通过 | 失败 | 阻塞 | 通过率 |
|------|------|------|------|------|--------|
| ... | | | | | |

**遗留问题：**
- [ ] #issue URL — 问题简述

**结论：** [通过/不通过]
```

- [ ] **Step 2: 提交**

```bash
git add test/测试方案.md
git commit -m "docs: add test plan part 2 — coverage matrix, process, tracking, report"
```

---

### Task 4: test/测试用例.md — 认证 + RBAC + 用户管理 + 组管理

**Files:**
- Create: `test/测试用例.md`

- [ ] **Step 1: 写出用例文档头部 + 认证模块**

**文档头部：** 包含用例说明、模板格式、优先级分类标准。

**TC-AUTH（认证，~10 条）：**

| ID | P | 用例名 | 核心描述 |
|----|---|--------|---------|
| TC-AUTH-001 | P0 | 正常登录 | 输入 superadmin/Admin@123 → 进入 dashboard，sidebar 正常渲染，Token 写入 |
| TC-AUTH-002 | P0 | 错误密码 | 输入错误密码 3 次 → 每次提示"用户名或密码错误"，不锁定 |
| TC-AUTH-003 | P0 | 空表单 | 用户名/密码任意为空 → 按钮不可点击或提示必填 |
| TC-AUTH-004 | P0 | 登出 | 点击登出 → 清除 Token → 跳转 /login → 访问 /files 重定向登录页 |
| TC-AUTH-005 | P0 | Token 过期 | 等待 Token 过期后操作 → 401 → 跳转登录页 |
| TC-AUTH-006 | P1 | 不存在用户 | 输入不存在的用户名 → 提示"用户名或密码错误" |
| TC-AUTH-007 | P1 | SQL 注入防护 | 用户名输入 `' OR '1'='1` → 不登录成功 |
| TC-AUTH-008 | P1 | 未登录访问受保护页面 | 直接访问 `/files`、`/cmdb` → 302 跳转 /login |
| TC-AUTH-009 | P2 | 登录页 UI | 居中卡片、Logo、输入框聚焦、Enter 提交 |
| TC-AUTH-010 | P2 | 密码框可见性切换 | 点击眼睛图标 → 密码明文/密文切换 |

每条 P0 写成步骤级（Step 1: 打开 http://localhost:3000/login，Step 2: 输入...），P1/P2 写成场景级。

- [ ] **Step 2: 写出 RBAC 权限模块**

**TC-RBAC（~12 条）：**

| ID | P | 描述 |
|----|---|------|
| TC-RBAC-001 | P0 | superadmin 可见所有模块（sidebar 全部菜单项） |
| TC-RBAC-002 | P0 | admin 可见租户级全部模块 |
| TC-RBAC-003 | P0 | member 角度看文件管理 — 只能看本组可见的文件 |
| TC-RBAC-004 | P0 | member 角度无"管理"入口（sidebar 不显示管理菜单） |
| TC-RBAC-005 | P1 | member 直接 POST API 创建用户 → 403 |
| TC-RBAC-006 | P1 | viewer 只读 — 列表可看，无新建/编辑/删除按钮 |
| TC-RBAC-007 | P1 | viewer 直接 POST API 上传文件 → 403 |
| TC-RBAC-008 | P1 | group_leader 可见本组日报审批 |
| TC-RBAC-009 | P1 | group_leader 不能看其他组的用户 |
| TC-RBAC-010 | P1 | member 不能修改系统配置 |
| TC-RBAC-011 | P2 | 无权限页面提示"无权限访问"并有返回按钮 |
| TC-RBAC-012 | P2 | Sidebar 菜单项随权限动态显示/隐藏 |

- [ ] **Step 3: 写出用户管理 + 组管理**

**TC-USER（~10 条）：** 新建用户/编辑/禁用/分配角色/密码重置/列表搜索/分页/创建时用户名重复/邮箱格式校验/必填项校验

**TC-GROUP（~8 条）：** 新建组/编辑组名/添加成员/移除成员/删除空组/删除有成员的组提示/组列表搜索/分页

- [ ] **Step 4: 提交**

```bash
git add test/测试用例.md
git commit -m "docs: add test cases — auth, RBAC, user, group"
```

---

### Task 5: test/测试用例.md — 日报 + 设备密码库

**Files:**
- Modify: `test/测试用例.md` (append)

- [ ] **Step 1: 写出日报系统 + 设备密码库**

**TC-REPORT（~11 条）：** 创建日报/选日期/填写内容/提交/查看审批状态/组长审批通过/组长驳回+理由/驳回后修改重新提交/日历视图/日报列表筛选/导出

**TC-DEVICE（~10 条）：** 新增设备/填写凭据/查看密码(需解密)/复制密码/编辑设备/删除设备/分组筛选/搜索/无权限用户看不到查看密码按钮/查看密码记录审计日志

- [ ] **Step 2: 提交**

```bash
git add test/测试用例.md
git commit -m "docs: add test cases — daily report, device vault"
```

---

### Task 6: test/测试用例.md — 通知中心 + AI 网关

**Files:**
- Modify: `test/测试用例.md` (append)

- [ ] **Step 1: 写出通知中心 + AI 网关**

**TC-NOTIF（~8 条）：** 查看通知列表/标记已读/未读数铃铛/全部已读/通知时间排序/通知内容完整性/通知铃铛30秒轮询/空状态提示

**TC-AI（~6 条）：** 调用 AI 模型/查看调用日志/切换 provider/配置 API Key/空配置报错提示/调用超时处理

- [ ] **Step 2: 提交**

```bash
git add test/测试用例.md
git commit -m "docs: add test cases — notification, AI gateway"
```

---

### Task 7: test/测试用例.md — 变更文档 + 审计日志

**Files:**
- Modify: `test/测试用例.md` (append)

- [ ] **Step 1: 写出变更文档 + 审计日志**

**TC-CHG（~13 条）：** 选择模板创建变更单/填写动态字段/保存草稿/提交审批/审批流流转/审批通过/审批驳回/导出 Word/导出 PDF/水印显示/归档到文件库/双模板切换/变更单搜索

**TC-AUDIT（~6 条）：** 审计日志列表/按模块筛选/按时间筛选/按操作人筛选/日志详情/分页

- [ ] **Step 2: 提交**

```bash
git add test/测试用例.md
git commit -m "docs: add test cases — change documents, audit log"
```

---

### Task 8: test/测试用例.md — CMDB

**Files:**
- Modify: `test/测试用例.md` (append)

- [ ] **Step 1: 写出 CMDB 全部用例**

**TC-CMDB（~19 条）：**

| ID | P | 描述 |
|----|---|------|
| TC-CMDB-001 | P0 | CMDB 搜索首页 — 跨模型关键词搜索 |
| TC-CMDB-002 | P0 | 选择模型 → 查看实例列表 |
| TC-CMDB-003 | P0 | 新建主机实例 — 填写动态表单 → 保存 |
| TC-CMDB-004 | P0 | 新建应用实例 — 动态表单字段根据模型变化 |
| TC-CMDB-005 | P0 | 实例详情页 — 属性展示 + 关联面板 |
| TC-CMDB-006 | P0 | 编辑实例 — 修改属性 → 保存 → 确认更新 |
| TC-CMDB-007 | P0 | 软删除实例 — 删除后列表不再显示 |
| TC-CMDB-008 | P0 | 建立实例关联 — 选择源/目标/关联类型 → 保存 |
| TC-CMDB-009 | P1 | 删除关联 — 确认后解绑 |
| TC-CMDB-010 | P1 | 必填属性校验 — 空值提交提示 |
| TC-CMDB-011 | P1 | 属性类型校验 — int 字段填字符串报错 |
| TC-CMDB-012 | P1 | 枚举属性 — 下拉选择合法值 |
| TC-CMDB-013 | P1 | 拓扑图 — 从实例进入拓扑全屏页，显示 nodes+edges |
| TC-CMDB-014 | P1 | 拓扑深度 — 选择 depth 1-5，图变化 |
| TC-CMDB-015 | P1 | 列自定义 — localStorage 持久化 |
| TC-CMDB-016 | P1 | 配置管理页 — 模型列表/新增/编辑（需 cmdb_model:write） |
| TC-CMDB-017 | P1 | 关联定义 — 新建/编辑模型间关联定义 |
| TC-CMDB-018 | P2 | 实例列表分页 |
| TC-CMDB-019 | P2 | 模型树切换 — 左侧树点击切换右侧实例表格 |

- [ ] **Step 2: 提交**

```bash
git add test/测试用例.md
git commit -m "docs: add test cases — CMDB"
```

---

### Task 9: test/测试用例.md — 共享文件库

**Files:**
- Modify: `test/测试用例.md` (append)

- [ ] **Step 1: 写出共享文件库全部用例**

**TC-FILE（~13 条）：**

| ID | P | 描述 |
|----|---|------|
| TC-FILE-001 | P0 | 创建文件夹 — 输入名称 → 文件夹树显示 |
| TC-FILE-002 | P0 | 上传 Excel — 选择 .xlsx → 列表出现文件 |
| TC-FILE-003 | P0 | 上传 Word — 选择 .docx → 列表出现文件 |
| TC-FILE-004 | P0 | 上传 PDF — 选择 .pdf → 列表出现文件 |
| TC-FILE-005 | P0 | 预览 Excel — 点击预览 → 页面渲染表格 HTML |
| TC-FILE-006 | P0 | 预览 Word — 点击预览 → docx-preview 渲染文档 |
| TC-FILE-007 | P0 | 预览 PDF — 点击预览 → iframe 嵌入展示 |
| TC-FILE-008 | P0 | 下载文件 — 点击下载 → 触发浏览器下载 |
| TC-FILE-009 | P0 | 删除文件 — 确认 → 列表移除 |
| TC-FILE-010 | P1 | 预览图片 — 点击预览 → img 展示 |
| TC-FILE-011 | P1 | 搜索文件 — 输入关键词 → 筛选结果 |
| TC-FILE-011 | P1 | 组可见性 — member 只看本组可见文件 |
| TC-FILE-012 | P1 | 大文件上传（>100MB）→ 提示或成功 |
| TC-FILE-013 | P1 | 不支持的格式预览 → 提示"此文件类型不支持在线预览"并显示下载按钮 |
| TC-FILE-014 | P2 | 文件夹树展开/折叠 |
| TC-FILE-015 | P2 | 文件列表分页 |

- [ ] **Step 2: 提交**

```bash
git add test/测试用例.md
git commit -m "docs: add test cases — shared files"
```

---

### Task 10: 最终审查

- [ ] **Step 1: 检查文档完整性**

- 两个文档是否都存在且格式正确
- 所有模块用例 ID 是否连续递增无缺失
- P0 用例是否都有详细步骤
- 测试方案和测试用例之间的引用是否一致

- [ ] **Step 2: 检查 git status，确认全部提交**

```bash
git status
git log --oneline -10
```

- [ ] **Step 3: 推送**

```bash
git push
```
