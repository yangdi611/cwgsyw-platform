# REM-P1-043：SMTP 配置输入校验

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-043` |
| 优先级 | P1 |
| 状态 | `VERIFIED` |
| 风险 | LOW |
| 来源 | `FQA_20260718_2050_remp1038` / `CONFIG-002` |

SMTP 配置接口接受带空格的非法 host 并返回 200。事件为 SMTP host、port 和发件地址建立明确的请求边界，在任何配置写入前返回 400，同时保持现有部分更新、密码掩码和 Mailpit 容器名兼容合同。

L1-L3 已通过：DTO/Controller/EmailService Java 21 定向测试、production compile、当前分支 backend build/health、7 个真实 API 边界、真实配置页错误反馈、Mailpit 实际发送与完整原配置恢复均通过；runId 日报为零。下一门禁为 event commit、no-ff 合并和 L4 `CONFIG-002` 受影响重验。
