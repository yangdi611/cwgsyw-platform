# REM-P1-076 Code Prompt

从 `lint-fix@920274e9` 的独立事件分支修复 `L4-RBAC-013-001`。只把 CMDB import read/execute、impact read、topology read 的后端和前端消费者切换到各自 canonical action。编辑每个生产符号前执行 GitNexus upstream impact；HIGH/CRITICAL 先告警。补齐 canonical-only allow、legacy-only deny、无副作用与 UI 一致性测试，完成 L1-L3、当前分支运行时、精确清理和证据回写。运行 `detect_changes()` 后提交，并按 `--no-ff` 合并到最新 `lint-fix`；随后恢复同一 L4 run，只重验受影响行及剩余未执行矩阵。禁止 restore、SQL 写、Redis 清理、非测试对象修改和 push。
