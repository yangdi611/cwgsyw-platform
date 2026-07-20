# REM-P1-054 实施记录

## 2026-07-20：认领与根因确认

- 基线 `lint-fix@43e1a940`；分支 `codex/rem-p1-054-watermark-angle-preview-contract`；L4 snapshot `49e6717e`。
- V11 已 seed `watermark.angle=45`，`ExportService.exportPdfDirect` 已读取该键；DTO、Controller 与管理 UI 遗漏 angle，且页面没有即时预览。
- GitNexus 四个目标均 LOW，0 受影响流程；无 HIGH/CRITICAL 告警。
- 事件只补齐既有键的可配置链、边界和预览；不新增迁移、不改变权限/路由/导出合同。
- 原始配置通过产品 API 精确恢复，shared manifest `objects=[]`、`cleanupFailures=0`；授权保持 enforced，break-glass inactive。

## 2026-07-20：实现与 L1-L3

- `WatermarkConfigRequest` 增加 `angle`，并对 opacity、angle、position 使用 Bean Validation；Controller 以 `@Valid` 保证完整请求先校验后写入 `watermark.angle`。
- `AdminConfigPage` 增加 angle 输入和基于现有表单状态的即时预览；保持既有权限、query key、路由、位置值和配置键不变。
- L1：`SysConfigControllerTest` 9/9、`WatermarkConfigRequestValidationTest` 2/2、`ExportServiceTest` 3/3，共 14/14；frontend 目标 lint 与 typecheck PASS。
- L2/L3：backend compile、frontend production build、backend/frontend Docker build 与健康检查 PASS；真实 Playwright `/tmp/rem-p1-054-watermark-runtime-rerun` 1/1（2.3s）PASS。
- 真实验证覆盖非法 opacity/angle/position 零部分写、angle -30° 即时预览、保存刷新、PDF angle key 读取、Console/5xx=0；最终配置精确恢复，manifest `objects=[]`、`cleanupFailures=0`。
- 首次 Playwright 超时是错误 locator 将 angle 放在错误 tab 的测试问题，发生在保存前且 finally 已恢复；随后修正 UI 实现位置和 locator 后通过，不构成产品失败。
- GitNexus staged detect：10 个当前已暂存文件、14 个符号、1 条 `AdminConfigPage → Cn` UI 流，风险 MEDIUM，均属 DTO/Controller/管理页/定向测试预期范围；补齐事件文档与测试资产后提交前复核。
- `compare master` 为 1570 个累计文件、295 条流程、CRITICAL，来源是长期 `lint-fix` 集成差异，不是 REM-P1-054 增量；本事件以 staged detect 为提交边界。
