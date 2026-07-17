# REM-P2-030 验证矩阵

| AC | 层级 | 检查 | 结果 | 证据 |
|---|---|---|---|---|
| AC-001 | L1 | DOCX 表格填充顺序、列值与 checkbox 呈现 | PASS | 既有 `ChangeDocTemplateServiceWordTest` 与新增 `ExportServiceTest` 共 `8/8`：模板路径克隆行、程序化回退保留 `first → second → third` 与“是/否”。 |
| AC-002 | L1/L2 | 程序化 DOCX 回退包含动态表格 | PASS | `ExportServiceTest` 覆盖无 DOCX 回退；当前分支 backend API 导出模板 #4 的 DOCX，`word/document.xml` 含列 `test1/teset2/test3` 和三行顺序。 |
| AC-003 | L1/L2 | 空行、空单元格、长文本与可打开性 | PASS | L1 空表保留表头；L2 输出 DOCX 为有效 OOXML（3,035 bytes）且包含空安全表格结构。CHANGE-006 既有 API 证据已覆盖空数组与 8,192 字符保存/无副作用。 |
| AC-004 | L1/L3 | 非表格导出、权限、状态与 tenant 回归 | PASS | 仅追加程序化回退表格，不改 Controller/权限/状态。真实已审批文档 #2 在当前分支页面下载 `CHG-20260628-001_方案.docx` 成功。 |
| AC-005 | L2/L3 | API 导出、真实浏览器下载、精确清理 | PASS | L2 `REM_P2_030_20260717_0917` 创建草稿 #221，导出后产品 DELETE 返回 200、关键词 `total=0`；L3 Chromium `/change-docs/2` 点击 Word 下载，Console/失败请求均为 0。 |

## 已知基线

- `FQA_L4_CHANGE_006_20260717_0855` 验证了 API 表格行顺序、空数组、8,192 字符长文本与 `maxRows=5` 拒绝无副作用，已清理。
- `FQA_L4_CHANGE_006_UI_20260717_0900` 通过真实 Chromium 创建后回读行顺序与 checkbox，已清理。
- 模板 #4 没有 DOCX，当前 `ExportService` 程序化回退未渲染动态表格字段；这不是通过条件，必须在本事件中修复并重跑 `CHANGE-006`。

## 环境说明

- 标准 Maven 定向 test 在 testCompile 前被既有无关源错误阻断：`OpsCalendarRuleServiceTest` 缺少 `SecurityUser`、`OpsCalendarTaskServiceTest` 的 `insert` 歧义、`GroupControllerGroupReferenceTest` DTO 类型错误。
- 使用项目编译产物和 JUnit Platform 独立编译运行本事件/模板测试；本机 JDK 26 需 `-Dnet.bytebuddy.experimental=true` 才能兼容现有 Byte Buddy。`8/8` 通过。`mvn -DskipTests compile` 及当前分支 backend Docker 构建均通过。
