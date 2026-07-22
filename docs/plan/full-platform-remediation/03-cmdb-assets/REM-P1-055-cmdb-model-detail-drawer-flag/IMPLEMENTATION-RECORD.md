# REM-P1-055 实施记录

## 2026-07-20：认领与根因确认

- 基线 `lint-fix@bc72f2e3`；分支 `codex/rem-p1-055-cmdb-model-detail-drawer-flag`；L4 snapshot `c6f77028`；事件 runId `REM_P1_055_20260720`。
- 同 run affected-only 资产已通过 enum 重复 option 拒绝、十字段 API、新建表单和列表，随后真实抽屉缺少全部动态字段。
- trace 模型详情响应包含十个属性和 `isListShow=true`，但全部遗漏 `isDrawerShow`；属性列表接口对同批属性返回 `isDrawerShow=true`。
- 根因是 `CiModelService.toAttributeVO` 漏调用 `vo.setIsDrawerShow(a.getIsDrawerShow())`。
- GitNexus upstream impact：LOW；1 个直接调用者、14 个四层依赖、1 个 Service 模块、0 条执行流，无 HIGH/CRITICAL 告警。
- shared manifest `objects=[]`、`cleanupFailures=0`；授权保持 Enforced epoch 32，break-glass inactive。

## 2026-07-20：实现与 L1-L3

- 产品根修仅在 `CiModelService.toAttributeVO` 增加 `vo.setIsDrawerShow(a.getIsDrawerShow())`；新增 `CiModelServiceContractTest` 通过公开 `getByCode` 覆盖 true/false 与 camelCase JSON。
- L1-L2：Java 21 定向与 CMDB metadata/attribute/VO/2D 聚类共 33/33、0 failure/error；backend compile PASS。
- L3：当前事件分支构建 backend 镜像 `sha256:6b103a6a...`，仅重建 backend；容器 healthy、actuator UP，PostgreSQL/Redis/MinIO/frontend/Nginx/卷未重建或清理。
- 真实 Playwright `/tmp/rem-p1-055-cmdb-drawer-r2` 1/1（2.6s）PASS：重复 enum option 400、十字段 API/表单/列表、真实 dialog/完整详情/关键属性及十组 label/value 全部通过，pageerror/HTTP 5xx 为零。
- instance、attributes、attribute group、model、model group 通过产品 API 逆序清理；模型关键词读回 0，shared manifest `objects=[]`、`cleanupFailures=0`。
- 正确只读端点确认 configured/effective/cutover 均 `enforced`、epoch 32。额外诊断曾误用不存在的 `/api/authorization/cutover/status` 和不支持 GET 的 `/api/rbac/break-glass`，各产生一个已解释 500；未执行授权切换、break-glass 激活或状态写入。
- GitNexus staged detect：LOW，12 个暂存文件中识别到 `CiModelService` 与 `toAttributeVO` 两个变更符号，0 affected flows，范围与事件一致。
- `compare master` 为 CRITICAL、1,584 个累计文件、300 条流程，属于长期 `lint-fix` 集成差异；本事件以 staged detect 和 `lint-fix@bc72f2e3` 基线差异为提交边界。
