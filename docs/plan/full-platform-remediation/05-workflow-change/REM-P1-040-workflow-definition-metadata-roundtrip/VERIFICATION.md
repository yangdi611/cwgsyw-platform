# REM-P1-040 验证

| AC | 层级 | 证据 | 结果 |
|---|---|---|---|
| AC-001 | L1 | `WorkflowDefinitionMetadataTest` 2/2；特殊字符、空 description、DI 保持 | PASS |
| AC-002 | L2/L3 | `test/rem-p1-040-workflow-metadata-roundtrip.spec.js`：v2 元数据 API/UI 往返 | PASS |
| AC-003 | L2/L3 | 真实 UserTask/SequenceFlow 编辑和二次重载 | PASS |
| AC-004 | L3 | backend Java 21 镜像构建成功，health `UP`，manifest 为空 | PASS |
| AC-005 | L4 | 合并后受影响范围重验 | PENDING |

宿主 Java 26 下既有 Mockito 生命周期测试因 Byte Buddy 仅支持至 Java 24 而环境报错；新纯单元测试独立 `2 tests, 0 errors, 0 failures`，生产 Java 21 构建通过。
