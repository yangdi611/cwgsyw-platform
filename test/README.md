# cwgsyw-platform 测试目录

## 目录结构

```
test/
├── README.md           # 本文档 — 目录说明与快速指引
├── 测试方案.md          # 测试方案 — 架构、层次、策略、流程
├── 测试用例.md          # 测试用例 — 各模块详细测试步骤与预期结果
├── fixtures/           # 测试夹具 — 上传/导入等操作使用的样本文件
│   ├── .gitkeep
│   ├── sample.xlsx     # 测试用 Excel
│   ├── sample.docx     # 测试用 Word
│   ├── sample.pdf      # 测试用 PDF
│   └── sample.png      # 测试用图片
├── manual/             # 手工测试用例 (按模块划分子目录)
│   ├── auth/
│   ├── daily-report/
│   ├── device/
│   ├── notification/
│   ├── ai-gateway/
│   ├── change-doc/
│   ├── cmdb/
│   └── shared-files/
├── e2e/                # E2E 自动化测试 (Playwright MCP YAML)
│   ├── login.spec.yaml
│   ├── files-upload.spec.yaml
│   └── cmdb-instance.spec.yaml
└── api/                # API 测试 (Bruno / Postman collections)
```

---

## 文档阅读顺序

| 顺序 | 文档 | 内容 |
|------|------|------|
| 1 | `测试方案.md` | 测试架构、层次策略（L1 单元 → L2 API → L3 E2E → L4 手工）、模块覆盖矩阵、核心用户流程、测试数据管理、CI 集成计划 |
| 2 | `测试用例.md` | 各模块详细的测试步骤、输入数据、预期结果、边界条件 |

先阅读 **测试方案.md** 了解整体策略与覆盖范围，再参考 **测试用例.md** 执行具体测试。

---

## 测试账号

| 账号 | 密码 | 角色 | 用途 |
|------|------|------|------|
| superadmin | `Admin@123` | super_admin | 全平台权限测试 |

其他角色账号（admin / leader / member / viewer）的密码详情见 `测试方案.md`。

---

## 环境要求

1. **Docker Compose** 启动全部容器：
   ```bash
   docker compose up -d
   ```
   包含：PostgreSQL 16, Redis 7, MinIO, Backend, Frontend, Nginx

2. 访问 `http://localhost:3000` 进入系统

3. 数据库迁移（Flyway）在容器启动时自动执行，无需手动操作

4. 测试夹具文件位于 `test/fixtures/`，供上传/导入类用例使用

---

## 测试层次

| 层次 | 工具 | 位置 |
|------|------|------|
| L1 单元测试 | JUnit 5 + Mockito | `backend/src/test/` |
| L2 API 测试 | Bruno / curl | 待定 |
| L3 E2E 测试 | Playwright MCP + Claude Code | `test/e2e/` |
| L4 手工验收测试 | 人工走查 | `test/manual/` |
