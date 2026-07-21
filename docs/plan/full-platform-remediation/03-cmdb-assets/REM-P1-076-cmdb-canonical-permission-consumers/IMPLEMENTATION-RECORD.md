# IMPLEMENTATION RECORD：REM-P1-076

## 2026-07-22 启动

- 源 run：`FQA_20260718_2050_remp1038`。
- 失败快照：`b8dbe90c2864d35da879d5d8a0facaa337c0ca1f`。
- L4 证据：`/tmp/fqa-2050-rbac013-cmdb-canonical-drift/result.json`。
- 真实差分：四个 canonical-only 请求均 403，legacy-guard-only 同请求均 200；所有夹具清理为 0/0。
- GitNexus upstream impact：`previewRaw`、`analyze`、`getTopology`、`compare` 均 LOW，0 direct callers、0 indexed processes。
- 实现范围：Controller/前端权限 guard 与定向测试；不改变业务服务或数据合同。

## 2026-07-22 实现与验证

- 后端 import read/execute、impact 和 topology/compare Controller 改为消费 canonical action；impact/topology 同时保留 `cmdb_instance:read` 目标数据可见性门禁。前端按钮、链接、tab、路由 redirect 与 query enabled 使用同一 action。
- GitNexus 编辑前 impact 均为 LOW；大多数 0 direct caller/process，`CiInstanceDrawer` 有 2 个直接消费者和 2 个 CMDB flow，未出现 HIGH/CRITICAL。
- Java 21 L1 `3/3`、CMDB L2 `55/55`、frontend typecheck、定向 ESLint `0 error`、backend package、backend/frontend production build 全部通过。
- 当前分支镜像 `sha256:b1c552a43fc0...` 与 `sha256:32cc690c87fc...` 仅替换 backend/frontend；backend healthy、actuator/gateway/frontend 均 200，Redis session epoch 保留，启动无未解释 ERROR。
- Playwright r4 `1/1 PASS`，证据 `/tmp/rem-p1-076-runtime-r4/result.json`。canonical 身份含功能 action 与必要目标读取权限，legacy 身份保留旧 substitute；API 与 UI 差分符合 SPEC，Console/pageerror/5xx 均为 0。
- r1 暴露测试清理按 keyword 未命中导入实例，实例/模型/模型组随后通过产品 API 精确删除，按 model 回读为 0；测试改为按 model 枚举后 r2-r4 每轮 manifest 均回到 0/0。未使用 SQL、restore、Redis 清理或非测试对象修改。
- 提交前 GitNexus `detect_changes(all)` 聚合为 CRITICAL：26 个 changed symbols、18 个 affected processes，均为本 SPEC 明确覆盖的 import/impact/topology Controller 与前端入口执行流；没有发现范围外模块、迁移或数据合同。该聚合等级来自多个 consumer 流程汇总，逐符号编辑前 upstream impact 均为 LOW，L2/L3 已覆盖对应 API/UI 流程。
