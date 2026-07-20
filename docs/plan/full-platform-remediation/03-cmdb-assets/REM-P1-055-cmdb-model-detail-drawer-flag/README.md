# REM-P1-055：CMDB 模型详情抽屉标记合同

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-055` |
| 优先级 | P1 |
| 领域 | CMDB |
| 状态 | `VERIFIED` |
| 风险 | LOW |
| 来源 | `FQA_20260718_2050_remp1038` / `CMDB-008`、`XL-CMDB-001` |
| 分支 | `codex/rem-p1-055-cmdb-model-detail-drawer-flag` |
| 基线 | `lint-fix@bc72f2e3` |
| 失败快照 | `c6f77028` |

模型详情组装遗漏 `CiAttribute.isDrawerShow`，导致真实实例列表抽屉无法展示配置为抽屉字段的动态属性。本事件仅补齐既有 DTO 字段映射和回归，不修改 schema、权限、租户、路由、查询键或前端行为。

L1-L3 已通过：Java 21 聚类 33/33、compile、当前分支 backend 镜像/healthy、真实 Playwright 1/1；十种动态字段 label/value 均在抽屉显示，Console/pageerror/5xx 为零，fixture 精确清理且 manifest 为空。

[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
