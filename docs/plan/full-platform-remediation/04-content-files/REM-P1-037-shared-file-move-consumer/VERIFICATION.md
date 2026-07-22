# REM-P1-037 验证与证据矩阵

| AC | 层级 | 结果 | 证据 |
|---|---|---|---|
| 源/目标管理授权 | L1 | PASS | Java 21：`SharedFileControllerTest#updateFile_checksBothManageBoundariesForMove` |
| 成功移动与冲突原子性 | L2 | PASS | `test/rem-p1-037-file-move-api.spec.js`：目标 `folderId` 回读、同名冲突 `409`、源列表不变 |
| 真实 UI consumer | L3 | PASS | `test/rem-p1-037-file-move-ui.spec.js`：文件页“移动文件”对话框、目标选择、成功反馈与列表回读 |
| 构建与静态检查 | L3 | PASS | Java 21 backend Docker 构建；`npm --prefix frontend run typecheck`；`npm --prefix frontend run lint -- --quiet`；frontend Docker 构建 |
| 清理 | L2/L3 | PASS | 新登录回读 `matchingFolders=0`；文件→目录均由产品 API 删除 |
