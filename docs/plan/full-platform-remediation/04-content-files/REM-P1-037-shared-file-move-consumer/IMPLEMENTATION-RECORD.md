# REM-P1-037 实施记录

## 2026-07-18：L4 新缺陷与修复

- L4 `FILE-012` 发现：文件夹移动与文件重命名均存在，但文件移动没有 DTO 字段、Controller/Service consumer 或 UI，登记 `BUG-FQA-107`。
- GitNexus：`updateFile` 上游 0、`renameFile` 上游 1（Controller）、`FilesPage` 上游 0；均 LOW，无执行流命中。
- 实现：`UpdateSharedFileRequest.parentId` 明确追踪提供状态；Controller 对源父目录和目标目录分别复用 `shared_file:manage` 检查；Service 事务内更新 `folderId`、目标目录规范名冲突与 `move` 审计；页面新增“移动文件”对话框。
- 不变：未修改授权模式、角色/assignment、对象存储键、owner、ACL 或非测试数据。
- 本机 Java 26 Maven 测试受 Mockito/Byte Buddy 最高 Java 24 支持限制而不能启动；隔离 Java 21 容器的两个定向测试通过。
- L2/L3 使用 `REM_P1_037_20260718_022000` 和 `REM_P1_037_20260718_022300`，所有临时文件/目录通过产品 API 删除，新登录回读零残留。
