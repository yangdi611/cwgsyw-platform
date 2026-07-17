# REM-P2-031：后端测试编译基线恢复

- 优先级：P2；领域：横切合同；状态：`VERIFIED`
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
