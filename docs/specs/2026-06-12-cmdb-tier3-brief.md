# CMDB Tier 3 需求 Brief

> 产物讨论结论，供 Product / Architect worker 参考。
> 前置依赖：Tier 2 全部完成

## 范围

拓扑图 + JSONB diff 视图 + 变更统计 + 数据中心 2D 视图（含拖拽编辑器）

## 关键决策

### 1. 拓扑图（交互式）
- 基于 ci_instance_rel 表
- D3.js 或 vis.js 渲染，可拖拽/缩放/点击节点跳转详情
- 按关联类型过滤（只看「依赖」或「运行于」）
- 颜色编码：绿=正常、黄=警告、红=故障

### 2. JSONB diff 对比视图
- 左旧右新对比（基于 audit_log 的 before_json / after_json）
- 字段级别高亮差异

### 3. 变更统计
- "本月修改最频繁的 CI Top 10"
- 按模型 / 操作人 / 时间范围聚合

### 4. 数据中心 2D 视图
- 机房俯视图：room 矩形 + rack 矩形（按房间比例缩放）
- 机柜立面图：前/后面板，U 位网格 + 设备矩形（跨 U 显示）
- 点击机柜 → 展开立面图
- 拖拽编辑器：可拖动机柜位置

## 不做的事（Tier 4）
- Prometheus 集成
- IPAM
- 跨模块联动
