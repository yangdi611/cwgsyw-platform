# REM-P1-043 验证矩阵

| AC | 层级 | 结果 | 证据 |
|---|---|---|---|
| host/port/from 边界在写入前拒绝 | L1 | PASS | `SmtpConfigRequestValidationTest`；Java 21 `SysConfigControllerTest` |
| 非法 API 返回 400 且配置不变 | L2 | PASS | 7 个真实请求均 400；8 个 SMTP 字段前后相同 |
| 合法 Mailpit 配置与实际发送 | L2/L3 | PASS | `test/rem-p1-043-smtp-config-validation.spec.js` 1/1；Mailpit 捕获日报待审批 |
| 原配置恢复、零测试数据残留 | L3 | PASS | disabled、空 host/user/password/from、465、SSL true；runId 日报 0 |
| 当前分支 backend 与真实配置 UI | L3 | PASS | branch image build、health UP；UI PUT 400、明确业务消息、无成功 toast、无未解释 Console error |

验证命令：

- `mvn -q -Dtest=SmtpConfigRequestValidationTest test`：PASS。
- `mvn -q -DskipTests compile`：PASS。
- Java 21 `mvn -q -Dtest=SmtpConfigRequestValidationTest,SysConfigControllerTest,EmailServiceTest test`：PASS。
- `docker compose -f docker-compose.dev.yml build backend`、仅替换 backend：PASS；其他核心容器 ID 不变。
- Playwright：`/tmp/rem-p1-043-l3-r3`，1/1 PASS，8.4 秒。
