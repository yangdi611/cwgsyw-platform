# REM-P1-037 实施合同

## 目标

关闭 `BUG-FQA-107`，为 `FILE-012` 提供文件在可见目录间移动的 API 与 UI consumer。

## 不变量

- 移动同时要求源文件父目录与目标目录的 `shared_file:manage` 和既有资源 ACL/scope 决策。
- 文件的对象存储键、owner、ACL、可见组和内容不变；仅 `folderId`、更新时间与审计动作变化。
- 目标目录中的规范名冲突返回 `409`，源目录状态不变。
- `parentId=null` 表示移动到根目录；未知目标目录拒绝且无副作用。
