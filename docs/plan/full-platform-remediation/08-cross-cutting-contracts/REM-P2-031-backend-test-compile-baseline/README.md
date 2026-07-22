# REM-P2-031：后端测试编译基线恢复

- 优先级：P2；领域：横切合同；状态：`CLOSED`
- 来源：`REM-P1-033` 的 L1 门禁在 Maven `testCompile` 阶段被三个无关测试源码错误阻断。
- 用户影响：任何后端定向测试均无法运行，导致已修复事件无法取得可审计 L1 证据。

## 范围

仅恢复以下测试与当前生产 API 的编译兼容性：

1. `OpsCalendarRuleServiceTest` 缺失的 `SecurityUser` 导入；
2. `OpsCalendarTaskServiceTest` 的 MyBatis-Plus `insert` 重载歧义；
3. `GroupControllerGroupReferenceTest` 使用旧 `Group` 请求类型。

不修改生产业务逻辑、API、数据库、权限或测试断言语义。

## 结论

三个测试源码兼容修复已完成。Maven `test-compile` 通过；在 Java 21 Maven 容器中，三个目标测试和此前被阻断的变更文档定向测试均通过。当前 Mac 的 Java 26 Mockito/Byte Buddy 不兼容仅作为本机环境限制记录，未修改依赖或生产代码。

## 文件

- [SPEC.md](./SPEC.md)
- [VERIFICATION.md](./VERIFICATION.md)
- [IMPLEMENTATION-RECORD.md](./IMPLEMENTATION-RECORD.md)
- [CLAUDE-CODE-PROMPT.md](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
