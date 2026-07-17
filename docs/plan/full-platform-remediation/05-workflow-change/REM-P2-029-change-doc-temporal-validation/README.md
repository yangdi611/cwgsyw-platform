# REM-P2-029：变更文档日期与日期时间有效性校验

- 优先级：P2；领域：流程与变更；状态：`VERIFIED`
- 来源：最终 L4 `FQA_20260716_2300_lintfix` 的 `CHANGE-005`。
- 问题：动态字段类型为 `date` 或 `datetime` 时，服务端未校验 ISO 格式和实际日历存在性，`2026-99-99` 可被创建并提交为 `plan_pending`。
- 用户影响：无效时间进入变更审批，影响排期、导出和审计数据可信度。
- 分支：`codex/rem-p2-029-change-doc-temporal-validation`，基线：`lint-fix@b63598e33`。
- 范围：在变更文档动态字段服务边界，对标量和表格单元格的 `date`/`datetime` 进行严格本地 ISO 日历校验；保持现有空值、必填、number、enum、状态机、权限和 API 路径合同。
- 非目标：不转换时区、不引入日期范围规则、不修改历史文档、不迁移数据、不改变前端控件或通用日期格式。
- GitNexus：`validateScalarValue` 的直接调用者为 `validateAndNormalize`，随后进入 create/update/submit/submitPlan；LOW 风险，无受影响执行流。
- 验证结论：L1 定向 `24/24` 通过；L2 实际会话 API 正反路径与零残留通过；L3 当前分支容器和真实浏览器创建/详情路径通过。
- 下一门禁：no-ff 合并后从最新 `lint-fix` 重跑 `CHANGE-005`，保留历史 FAIL 并追加 `REVERIFY PASS`。

## 文件

- [SPEC.md](./SPEC.md)
- [VERIFICATION.md](./VERIFICATION.md)
- [IMPLEMENTATION-RECORD.md](./IMPLEMENTATION-RECORD.md)
- [CLAUDE-CODE-PROMPT.md](./CLAUDE-CODE-PROMPT.md)
