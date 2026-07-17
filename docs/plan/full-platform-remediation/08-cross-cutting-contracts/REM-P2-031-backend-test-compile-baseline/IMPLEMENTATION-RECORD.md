# REM-P2-031 实施记录

2026-07-17：用户明确授权建立独立事件。GitNexus 对三个拟修改测试方法执行 upstream impact：均为 LOW、无调用者或执行流程。分支从 `lint-fix@d368f380` 创建；仅计划修改三个测试文件和事件台账。

2026-07-17：补入 `SecurityUser` 导入、将 Mockito `insert(any())` 收窄为 `OpsScheduleTask.class`、将过时的 `Group` 请求替换为 `GroupRequest`。未改生产源码。`mvn -q -Dmaven.test.skip=true test-compile` 通过。Java 21 `eclipse-temurin:21-jdk-alpine` 容器内三个目标测试通过，随后 `TableFieldSupportTest`、`ExportServiceTest`、`ChangeDocTemplateLifecycleTest` 和 `ChangeDocTemplateServiceWordTest` 通过。当前本机 Java 26 的 Mockito inline/Byte Buddy 不兼容仅导致环境错误，不修改依赖；Dockerfile 的生产构建目标本来就是 Java 21。
