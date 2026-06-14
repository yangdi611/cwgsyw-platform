# CMDB T1-T4 全量验收报告 — Bug 汇总

> 日期: 2026-06-14  
> 环境: Docker 6 容器 (development 分支)，nginx:80，backend:8081  
> 验证人: Tester Agent (T2/T3/T4 完成，T1 运行中)

---

## 总览

| Tier | 状态 | API 通过 | 阻断裂 |
|------|------|----------|--------|
| T1 | 🔵 运行中 | - | - |
| T2 | ❌ 不通过 | 0% | ci_attribute_group 缺 6 列 |
| T3 | ❌ 不通过 | 2/7 (29%) | ci_instance 缺 3 字段 + 关联表 |
| T4 | ❌ 不通过 | - | 编译错误，镜像无法构建 |

**共同根因: 数据库 Flyway 迁移与代码不一致**

---

## P0 阻断 — 数据库 Schema

### 1. ci_attribute_group 缺列

**影响**: 所有 CMDB API 500，T2/T3/T4 前端全部不可用

```sql
-- Bug t_b11439ad
-- ci_attribute_group 表缺少以下列:
code           VARCHAR(100) NOT NULL
group_id       BIGINT
display_order  INT
is_required    BOOLEAN DEFAULT FALSE
is_readonly    BOOLEAN DEFAULT FALSE
validation_rule VARCHAR(500)
```

### 2. ci_instance 缺字段

**影响**: T3 变更历史/拓扑 API 500

```sql
-- Bug t_a27159fd
-- ci_instance 表缺少:
status         VARCHAR(50)
owner          VARCHAR(100)
description    TEXT
```

### 3. 关联关系表字段不一致

```
ci_instance_rel — code 字段使用 src_id 而非 src_instance_id
```

---

## P0 阻断 — 编译错误

### 4. 方法缺失

```
CiNotificationService.java — findUserIdsByRoleIds() 未定义
DailyReportService.java   — CiModel.getModelId() 未定义
```

**影响**: backend Docker 镜像无法编译

---

## P1 问题

| 问题 | Tier | 描述 |
|------|------|------|
| 影响分析前端缺失 | T2 | PNG 导出组件依赖 `html-to-image` 未正确集成 |
| 拓扑图增强未完成 | T3 | 10 项验收标准仅 1 项达标 |
| 凭证管理缺 UX | T4 | 前端有页面，交互不完整 |

---

## 已确认正常的

- ✅ 前端 200 正常，页面渲染
- ✅ 认证系统正常 (superadmin/Admin@123)
- ✅ Docker 6 容器全部 Running
- ✅ T1/T3 前端页面文件存在 (6-8 个 page.tsx)
- ✅ IPAM (T4) 前后端完整
- ✅ CSV 导入 (T2) 前端组件存在

---

## 修复建议

1. **P0 优先**: 修复 Flyway 迁移，补全 ci_attribute_group + ci_instance 字段
2. **P0 优先**: 修复编译错误 (CiNotificationService + CiModel)
3. **P1 后续**: 影响分析前端、拓扑增强、凭证 UX
