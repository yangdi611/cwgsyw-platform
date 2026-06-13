# CMDB Tier 1 需求 Brief

> 产品讨论结论摘要，供 Product / Architect worker 参考。

## 范围

模型 CRUD + 实例 CRUD + 关联关系 CRUD + 变更历史 + Flyway 迁移（V14-V19 重建）

## 现有基础

- DB 中已存在 8 张 CI 表（ci_model / ci_attribute / ci_attribute_group / ci_instance / ci_instance_rel / ci_association_kind / ci_association_def / ci_model_group）
- 迁移 V14-V19 已执行但文件缺失在磁盘上，需从 DB dump 反向重建
- Seed 数据：host 模型（13属性）、app 模型（5属性）、5 种关联类型、5 个模型分组、4 个属性分组

## 关键决策

### 1. 关联关系
- **使用已有 `ci_instance_rel` 表**，不做字段值引用方案
- 5 种关联类型：bk_mainline(主线拓扑)、belong(属于)、run(运行)、connect(连接)、depend(依赖)
- 拓扑查询基于 ci_instance_rel 做 BFS/DFS 图遍历，最大深度 5 层

### 2. 变更历史
- **复用平台 `audit_log` 表**，不新建 cmdb_change_log
- 写操作时同步写 audit_log（module="cmdb"）
- 前端查询时对 before_json/after_json 做 JSONB diff 展示

### 3. 模型管理
- Flyway 管理内置模型（host/app 已存在）
- UI 管理自定义模型（混合模式）
- 字段类型：singlechar / longchar / int / enum / objuser（已有）

### 4. 实例数据
- 使用已有 `ci_instance` 表，attrs 字段为 JSONB
- 动态表单：根据 ci_attribute 定义渲染

### 5. 权限
- cmdb_model:create/read/update/delete
- cmdb_instance:create/read/update/delete
- cmdb_relation:create/read/delete

### 6. 删除策略
- 逻辑删除（MyBatis-Plus @TableLogic），沿用平台规范

### 7. 字段变更
- 仅允许新增字段 + 修改 required/default/is_editable
- 不允许改名/改类型

## 不做的事（Tier 2-4）
- CSV 批量导入
- 拓扑图可视化
- Prometheus 集成
- IPAM
- 跨模块联动
