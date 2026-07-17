# REM-P2-031 验证矩阵

| AC | 命令/检查 | 结果 |
|---|---|---|
| AC-001 | `mvn -q -Dmaven.test.skip=true test-compile` | PASS |
| AC-002 | Java 21 容器：`OpsCalendarRuleServiceTest,OpsCalendarTaskServiceTest,GroupControllerGroupReferenceTest` | PASS |
| AC-003 | Java 21 容器：`TableFieldSupportTest,ExportServiceTest,ChangeDocTemplateLifecycleTest,ChangeDocTemplateServiceWordTest` | PASS |

本事件不创建运行时数据，不需要 L3 容器重建；L3 等价证据为生产代码未改动、测试门禁恢复和完整后端测试编译通过。

本机 Java 26 运行 Mockito inline tests 仍报 Byte Buddy 仅支持到 Java 24；该环境限制不影响 Java 21 容器的通过结果，也未通过升级依赖掩盖。
