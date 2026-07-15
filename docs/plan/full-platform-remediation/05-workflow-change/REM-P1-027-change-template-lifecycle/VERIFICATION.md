# REM-P1-027 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | CHANGE-014 | L1 | Java 21：`ChangeDocTemplateServiceWordTest`、`ChangeDocTemplateLifecycleTest` 通过 | `PASS` |
| `AC-002` | CHANGE-015 / CHANGE-016 / CHANGE-018 | L2 | `REM_P1_027_20260715215217`：number/enum/default/sort 保存后复制保持独立字段；引用模板 DELETE 返回 400；删除文档后模板删除成功 | `PASS` |
| `AC-003` | 边界 / deny / 零副作用 | L2 | 无效枚举配置、非法 number/enum 值稳定拒绝；引用存在时未删除字段、模板或对象 | `PASS` |
| `AC-004` | 受影响模块 | L3 | 后端镜像重建/健康检查通过；前端 typecheck 通过，lint 0 error（41 个既有 warning） | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | impact 已记录；runId 文档与两个模板均由产品 API 精确清理；提交前执行 detect_changes | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

历史证据为 `BUG-FQA-048`、`BUG-FQA-083`、`BUG-FQA-098` 对应章节。PASS 要求行为、持久化、权限、审计、清理全部一致；残留或未解释 5xx/Console error 为 FAIL；缺授权或精确清理为 BLOCKED。禁止覆盖历史证据。
