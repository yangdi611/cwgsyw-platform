# CMDB Tier 2 需求 Brief

> 产物讨论结论，供 Product / Architect worker 参考。
> 前置依赖：Tier 1 全部完成

## 范围

关联关系 CRUD + CSV 批量导入 + 影响分析

## 关键决策

### 1. 关联关系 CRUD
- 基于 Tier 1 已实现的 ci_instance_rel 表
- 前端：关联关系管理 UI（增删查，5 种类型）
- 前端：交互式拓扑图（D3.js 或 vis.js，可拖拽/缩放/按类型过滤）

### 2. CSV 批量导入
- 按模型导入实例
- 字段映射：CSV 列 → CMDB 属性（ci_attribute 定义）
- 校验 + 错误行报告
- 支持 host / app / network_device / middleware 等所有模型

### 3. 影响分析
- BFS/DFS 图遍历，基于 ci_instance_rel
- 最大深度 5 层
- 输出：树形列表（indented）
- 按需调用（不做自动风险提示）
- API 端点供变更文档等模块调用

## 不做的事（Tier 3-4）
- JSONB diff 视图
- 数据中心 2D 视图
- Prometheus 集成
- IPAM
