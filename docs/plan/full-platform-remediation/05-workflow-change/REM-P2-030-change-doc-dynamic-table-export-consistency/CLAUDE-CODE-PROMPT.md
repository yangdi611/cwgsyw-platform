# REM-P2-030 执行提示

在 `lint-fix` 最新干净提交上创建唯一分支 `codex/rem-p2-030-change-doc-dynamic-table-export-consistency`，只处理本事件。先读根 `AGENTS.md`、本目录五件套、L4 `CHANGE-006` 证据和相关导出代码。

对每个拟修改符号先执行 GitNexus upstream `impact`；若 HIGH/CRITICAL，停止编辑并报告风险。最小修复必须让 DOCX 模板导出和程序化 DOCX 回退都表达 `fixedDocxTable` 的标题、列、顺序、值、空行与 checkbox，且不改变权限、状态、tenant、普通字段或历史文档。

完成 L1 定向测试、L2 实际会话导出内容校验、L3 当前分支容器和真实浏览器下载后，所有 runId 文档及通过产品 API 创建的模板必须精确清理。不得使用 SQL、对象存储绕过、Redis/session/volume 清理或修改既有业务对象。更新本事件五件套、`INDEX.md`、`FQA-COVERAGE-MATRIX.md`、根 `README.md` 和 `REMEDIATION-CHECKPOINT.json`；提交前运行 GitNexus `detect_changes`。事件提交后才允许 `--no-ff` 合并至 `lint-fix`，并从合并头重跑 `CHANGE-006` L4。
