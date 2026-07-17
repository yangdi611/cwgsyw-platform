# REM-P1-037：共享文件移动生命周期

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-037` |
| 优先级 | P1 |
| 领域 | `04-content-files` |
| 状态 | `VERIFIED` |
| 风险 | LOW |
| 来源 | `FQA_20260718_0043_remp1036_l4` / `FILE-012` |

## 问题与结论

`FILE-012` 发现文件本体没有移动 consumer：旧 `PUT /api/files/{id}` 只支持重命名，页面也没有移动入口。事件补充受 `shared_file:manage` 与源/目标父目录资源检查保护的文件移动，保持对象存储键、owner、ACL 和可见组不变。

L1-L3 已通过；所有 runId 文件与目录通过产品 API 精确清理。等待从新 `lint-fix` 集成点重新启动最终 L4。
