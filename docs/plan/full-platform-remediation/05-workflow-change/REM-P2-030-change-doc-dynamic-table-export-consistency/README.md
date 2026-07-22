# REM-P2-030：变更文档动态表格导出一致性

- 优先级：P2；领域：流程与变更；状态：`CLOSED`
- 来源：最终 L4 `FQA_20260716_2300_lintfix` 的 `CHANGE-006`。
- 问题：固定表格字段的创建、编辑、排序和边界校验已通过，但模板 #4 没有 DOCX；导出回退的程序化生成不渲染动态表格字段，因此无法证明导出内容与已保存行一致。
- 用户影响：用户可能在页面确认表格数据后得到缺少该表格的导出文档，造成变更材料不完整。
- 范围：为带 `fixedDocxTable` 的变更文档定义可验证的 DOCX 模板填充与程序化回退导出合同，保证行顺序、列值、checkbox 呈现和空行规则一致。
- 非目标：不改变表格行的增删、最小/最大行数、动态字段输入校验、导出权限、审批状态机或历史文档；不通过直接对象存储写入伪造测试模板。
- 当前证据：`CHANGE-006` 的 API 与真实 UI 生命周期已通过；两个 runId 对象均经产品 DELETE 精确清理，关键词回读 `total=0`。导出一致性尚未验证，L4 因此暂停。
- 分支：`codex/rem-p2-030-change-doc-dynamic-table-export-consistency`，基线：`lint-fix@49eb97654`。
- 验证结论：L1 DOCX 模板与程序化回退定向测试 `8/8` 通过；L2 当前分支 backend 实际 DOCX 导出按行顺序输出表格；L3 真实浏览器 Word 下载、零 Console/失败请求通过，测试数据已精确清理。
- 下一门禁：提交并 `--no-ff` 合并到 `lint-fix` 后，从合并头重跑 L4 `CHANGE-006`。

## 文件

- [SPEC.md](./SPEC.md)
- [VERIFICATION.md](./VERIFICATION.md)
- [IMPLEMENTATION-RECORD.md](./IMPLEMENTATION-RECORD.md)
- [CLAUDE-CODE-PROMPT.md](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
