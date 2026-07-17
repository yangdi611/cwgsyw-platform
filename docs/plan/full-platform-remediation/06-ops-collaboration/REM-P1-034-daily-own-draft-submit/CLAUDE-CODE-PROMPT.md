# REM-P1-034 执行入口

仅修复日报“全部日报/本组日报”视图中当前用户本人草稿的提交入口。编辑 `DailyReportsPage` 前执行 GitNexus upstream impact；使用既有 `reporterId` 和 auth `userId`，不以审批权限推断本人。完成 L1-L3、runId 精确清理、台账回写、提交和 `--no-ff` 合并后，才恢复 L4。
