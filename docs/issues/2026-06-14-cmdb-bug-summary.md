# CMDB T1-T4 浏览器验收报告（最终版）

> 日期: 2026-06-14（首次轮次）
> 第二轮 Bug 修复请参见 [2026-06-17-cmdb-bug-fixes-round2.md](2026-06-17-cmdb-bug-fixes-round2.md)  
> 验证方式: Headless 浏览器 (browser_navigate/snapshot)  
> 环境: Docker 6 容器 (development 分支)，http://localhost:80  
> 认证: superadmin / Admin@123

---

## 总览

| Tier | 结果 | 页面 | API | Bug |
|------|------|------|-----|-----|
| T1 | ⚠️ | 12/12 ✅ | 12/12 ✅ | 1 P0 |
| T2 | ⚠️ | 9/9 ✅ | 全部 ✅ | 0 (P0 已修复) |
| T3 | ✅ | 7/7 ✅ | 7/7 ✅ | 0 |
| T4 | ✅ | 13/13 ✅ | 6/6 ✅ | 0 |

---

## T1 — 模型/属性/实例/关联/变更历史 ✅

页面 12 个全部 200，API 12 个 RBAC 正常。

### 🐛 P0 Bug
- **t_1c1b805b**: 创建实例时前端发送 `model` 而非 `modelId` → 实例创建失败

---

## T2 — 关联管理/CSV导入/影响分析/拓扑 ⚠️

V37 迁移已修复 ci_attribute_group 缺列问题（上一轮 P0 Bug 消解）。

所有 9 个页面 200，API 端点 RBAC 正常。

### ⚠️ 局限性
cua-driver 截图功能不可用 → 交互测试（拖拽、表单提交、CSV 上传）未实操验证。

---

## T3 — JSONB diff/拓扑增强/统计/2D视图 ✅

**全部通过**。P0 Bug (V35 schema drift) 已修复。

| 功能 | 状态 |
|------|------|
| 变更统计面板 (今日/本周/本月) | ✅ |
| Top10 变更排行 | ✅ |
| 全局变更历史 + JsonDiffView | ✅ |
| 过滤/分页 | ✅ |
| 拓扑图对比模式 + PNG导出 | ✅ |
| 2D 视图 (CSS Grid + groupBy) | ✅ |
| 模型管理 color + enable2dView | ✅ |

---

## T4 — IPAM/生命周期/凭证/告警 ✅

**全部通过**。13 页面 200，Flyway V28-V34 完整，无 Bug。

### 已实现
- IP 地址池 CRUD
- CI 生命周期管理
- 凭证管理（含租户隔离）
- 变更文档-CI 关联
- CMDB 告警端点
- 通知服务

---

## 已修复的 Bug

| Bug | 说明 | 状态 |
|-----|------|------|
| t_a27159fd | V35 schema drift (ci_instance 缺字段) | ✅ |
| t_b11439ad | ci_attribute_group 缺 6 列 | ✅ |
| t_9e312770 | 实例详情页缺变更历史 tab | ✅ |
| t_d44690dc | 变更统计卡片不可点击跳转 | ✅ |
| t_ab3166f1 | 模型管理缺 color/2d_view | ✅ |

---

## 待修复

| Bug | 优先级 | 说明 |
|-----|--------|------|
| t_1c1b805b | P0 | 创建实例 model→modelId 参数名 |

---

## 系统改进（本轮完成）

- Tester 模型: deepseek-v4-pro (vision)
- Tester skill: v2.2 — headless browser (browser_navigate/snapshot)
- Merge 流程: 加入 Phase 2 链末尾 + development 推送
- Docs gh 认证: 已配置
- DevOps 模型: glm-5.1
- 侧边栏: 树状结构（流程引擎/CMDB/资产管理/权限管理/系统管理）
