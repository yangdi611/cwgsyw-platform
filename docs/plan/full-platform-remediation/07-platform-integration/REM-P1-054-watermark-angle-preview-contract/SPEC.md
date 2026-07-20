# REM-P1-054 实施合同

## 目标

- 管理页可配置 `watermark.angle`，并与 V11 默认值和 `ExportService` 既有消费键一致。
- 水印表单在未保存时即时预览开关、文本、透明度、角度与五种位置。
- opacity 仅允许 `0..1`，angle 仅允许 `-180..180`，position 仅允许既有五值；非法请求在任何配置写入前返回 400。
- 保存、刷新、PDF 导出消费和精确恢复形成完整 `CONFIG-004` 证据链。

## 范围

- `WatermarkConfigRequest`
- `SysConfigController.updateWatermark`
- `AdminConfigPage` 的水印区域
- Controller、前端交互与 PDF 导出定向测试
- L4 `CONFIG-004` affected-only 测试资产

## Non-goals

- 不新增数据库迁移，不改 `watermark.font_size`、权限、路由、租户边界或导出文件合同。
- 不修改正式 Workflow/Wiki binding，不恢复或直接写数据库。
- 不把 position 与 angle 合并；两者保持独立兼容字段。

## 影响分析

- `WatermarkConfigRequest`：LOW，3 个直接依赖、0 流程。
- `SysConfigController.updateWatermark`：LOW，1 个测试调用、0 流程。
- `AdminConfigPage`：LOW，0 上游、0 流程。
- `ExportService`：LOW，2 个测试依赖、0 流程；本事件只补回归，不改其既有消费逻辑。

## 验收条件

| AC | 条件 |
|---|---|
| `AC-001` | API 保存/读取 angle；非法 opacity/angle/position 返回 400 且零部分写入。 |
| `AC-002` | UI 可修改 angle，预览即时反映开关、文本、opacity、angle 与 position。 |
| `AC-003` | 保存刷新后字段持久化，PDF 导出使用相同 angle 键。 |
| `AC-004` | 原始配置经产品 API 精确恢复；manifest 为空、Console/5xx 为零。 |
| `AC-005` | Java、前端 lint/type/build、当前容器与真实 Playwright L1-L3 全部通过。 |

## 回滚

删除新增 angle 字段、Controller 写入、UI 控件/预览和测试；既有 V11 配置与 ExportService 行为保持不变，无数据或 schema 恢复。
