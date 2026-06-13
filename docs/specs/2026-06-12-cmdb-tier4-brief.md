# CMDB Tier 4 需求 Brief

> 产物讨论结论，供 Product / Architect worker 参考。
> 前置依赖：Tier 3 全部完成

## 范围

Prometheus 集成 + IPAM + 跨模块联动（密码库/变更文档/日报）+ 通知 & 生命周期

## 关键决策

### 1. Prometheus 集成
- **CMDB 是 SD 喂料器**，Prometheus 不负责自动发现
- http_sd 端点：`/api/cmdb/sd-targets?model=host|app`
- 信息回填定时任务：从 Prometheus API 拉 stable 信息（SN/OS/CPU/内存/磁盘/网卡），补充 CMDB 空字段
- 数据漂移检测：周期性对比 Prometheus 实际值 vs CMDB 记录

### 2. IPAM
- **独立模块**：URL `/api/ipam/...`，前端 `/ipam` 路由
- 子网 CRUD：IPv4 + IPv6
- IP 分配/回收 + 冲突检测 + 自动推荐下一个可用 IP
- 关联 CMDB instance（ci_instance_id）
- **松耦合**P1：inner_ip 手动填，IPAM 独立管，冲突检测兜底

### 3. 密码库联动
- device_credential 表加 `cmdb_instance_id` 字段
- 创建凭证时可从 CMDB 搜索选择主机
- CMDB host 详情页显示关联凭证（可解密，需 device:view_password 权限）
- 密码库凭证过期提醒

### 4. 变更文档联动
- 新增 change_doc_ci_ref 关联表
- 创建变更单时可选 CI 实例，自动计算影响范围（调用影响分析 API）
- 变更单详情显示受影响 CI 列表 + 可点击跳转

### 5. 日报联动
- 新增 daily_report_ci_ref 关联表
- 写日报时 @ 引用 CI 实例
- CI 详情页显示维护历史时间线
- 日报统计聚合

### 6. 通知 & 生命周期
- 资产字段：ci_instance 新增独立列（lifecycle_status, lifecycle_stage, asset_category, purchase_date, purchase_price, vendor, warranty_start, warranty_end, contract_no）
- 模型特有资产字段走 attrs JSONB
- 生命周期状态：
  - host / network_device: 到货→上架→运行→下架→入库房（利旧→运行循环，待报废→报废）
  - middleware: 部署→运行→维护→升级中→下线→归档（含维保周期 vendor + warranty）
  - app: 开发→测试→预发布→生产→下线→归档
- 保修/维保/license 到期提醒（通知中心定时检查）
- 通知中心统一接入 CMDB 事件（状态变更、到期等）
- 资产盘点报表（按模型/状态/机房导出）
- 资产生命周期工作流（Flowable BPMN，可选接入）
