# REM-P1-040 实施记录

## 2026-07-19

- 基线 `lint-fix@1254925a1`；分支 `codex/rem-p1-040-workflow-definition-metadata-roundtrip`；runId `REM_P1_040_1784394569677`。
- L4 根因：`updateDefinition` 部署编辑器 XML，却没有把请求 name/category/description 写回 process name、targetNamespace/documentation，因此 Flowable v2 继续读取 v1 元数据。
- GitNexus：`updateDefinition` LOW，2 个直接 Controller 调用、1 个流程、1 个模块；`deployDefinition` LOW，5 个上游、2 个流程、仅 Workflow。
- 修复：安全 DOM 解析并同步定义元数据后序列化；保留 key、画布、Flowable 扩展、权限和版本语义。
- L1：新单测 2/2。宿主 Java 26 的既有 Mockito 测试受 Byte Buddy 版本环境限制；Java 21 生产镜像编译 549 个源文件并构建成功。
- L2/L3：仅重建 backend，health `UP`；真实编辑页缩放、任务/连线属性、v2 保存、API 回读、二次重载全部通过，Playwright `1 passed (3.9s)`。
- 清理：定义所有版本经产品 DELETE 删除，versions 回读为空；manifest `objects=[]`、`cleanupFailures=0`。正式 `wiki_page -> remp1038wiki` 策略未改动。
- 回滚：回退本事件提交；无迁移、历史写入或外部配置。
