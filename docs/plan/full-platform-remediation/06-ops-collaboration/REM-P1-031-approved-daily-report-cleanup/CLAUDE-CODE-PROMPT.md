# REM-P1-031 执行入口

只完成“已审批整改日报精确清理”。先读取根规则、质量规则、总索引、检查点和本目录五件套；从 `lint-fix` 独立分支实施。

编辑 `DailyReportService.purgeRemediationReport` 前执行 GitNexus upstream impact。只扩展受限测试标记识别：完整 runId 或时间戳精确匹配的历史 FQA 标记；不得增加通用删除、修改审批状态或放宽 tenant/platform 边界。L1-L3 覆盖完整、历史标记、错误标记、权限和零副作用；当前分支容器运行时复验后精确清理。回写本事件、索引、矩阵、README、BLOCKED 计划和检查点；通过后提交并 `--no-ff` 合并到 lint-fix。
