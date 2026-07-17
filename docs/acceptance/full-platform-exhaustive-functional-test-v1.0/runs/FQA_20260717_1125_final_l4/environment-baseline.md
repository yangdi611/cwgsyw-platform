# 最终 L4 环境基线

| 项目 | 值 |
|---|---|
| runId | `FQA_20260717_1125_final_l4` |
| 分支 | `codex/fqa-final-l4-revalidation` |
| 集成基线 | `lint-fix@de196e8275a8a8891e119e9fa64c75c9cd49d5e3` |
| 后端 | `cwgsyw-platform-backend-1`，`8081->8080`，health `UP` |
| 前端 | `cwgsyw-platform-frontend-1`，`3001->3000` |
| 网关 | `nginx`，`80->80` |
| 数据服务 | PostgreSQL、Redis、MinIO 均为既有健康容器；本轮未重建或清空 |
| 授权范围 | 不执行未单独授权的全租户 Rollback/Legacy/Enforced、break-glass 或 restore |

主用例与状态用例的关闭分母分别采用测试目录声明的 `275` 与 `78`。表格正文行数包含非用例行，不能代替唯一 ID 台账。
