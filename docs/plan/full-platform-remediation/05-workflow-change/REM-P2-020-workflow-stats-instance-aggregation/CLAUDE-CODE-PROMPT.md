# REM-P2-020 Claude Code 执行入口

只完成 `REM-P2-020：Workflow 统计与实例聚合一致性`。先完整读取根 `AGENTS.md`、质量规则、整改根 README/INDEX/检查点、本目录全部文件以及 L4 `FLOW-013` 失败记录。

目标是让流程统计与可读取的运行/完成实例列表按 definition key 对账一致；不得修改或清理历史流程实例、定义、任务、权限或审计。统计读取必须无副作用，既有 DTO、权限和路由不变。

从 `codex/rem-p2-020-workflow-stats-instance-aggregation` 和 `lint-fix@8736b8f1` 继续。编辑任何函数、类或方法前必须做 GitNexus upstream impact；HIGH/CRITICAL 停止并报告。用最小根因修改，补定向测试，执行 L1-L3、当前分支 backend 容器和真实 Playwright UI/API 对账；测试数据如需创建必须带 runId 并通过产品 API 清理。Maven 全量 test compile 若被既有无关源码阻断，须留证但不得伪造通过。

通过后回写本目录 README/VERIFICATION/IMPLEMENTATION-RECORD、根 INDEX/README/FQA-COVERAGE-MATRIX/检查点；`detect_changes`、JSON 和差异检查通过后创建事件提交，使用 `--no-ff` 合并 `lint-fix`，验证祖先关系，再重建独立 L4 分支继续。不得 push、修改非测试数据、全局授权切换、restore 或清空会话。
