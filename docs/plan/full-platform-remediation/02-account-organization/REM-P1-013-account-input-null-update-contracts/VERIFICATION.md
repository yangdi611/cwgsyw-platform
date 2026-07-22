# REM-P1-013 验证与证据矩阵

## 验收映射

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | GROUP-CRUD | L1 定向 | `{}`、空白、65 字符组名均返回 400；有效组创建/更新通过 | `PASS` |
| `AC-002` | ACCOUNT-001 / ACCOUNT-003 / RBAC-002 | L2 根因聚类 | 非法 email、65 字符 username 均 400；手机号设置后清空回读为 null，profileCompleted=false | `PASS` |
| `AC-003` | 边界 / deny / 无副作用 | L2 | 失败请求零对象；runId 用户和组均经产品 API 精确清理，零残留 | `PASS` |
| `AC-004` | 受影响模块 | L3 | 当前分支前后端编译、Docker 构建、API/UI 定向复验通过 | `PASS` |
| `AC-005` | GitNexus / cleanup / rollback | L3 | 授权的隔离开发临时 retention=0 清理后恢复 30；detect_changes LOW、零残留 | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新发布候选 run | `PENDING` |

## 原始失败证据

历史结论位于 `defects.md` 的 `BUG-FQA-015`、`BUG-FQA-044`、`BUG-FQA-085` 章节及 `test-results/FQA_20260712_0329_lintfix/`。修复后证据必须新建目录，禁止覆盖首次失败截图、trace 或 result。

## 执行规则

- PASS：预期、持久化、副作用、权限、审计和清理全部一致。
- FAIL：任一原始路径仍失败、出现未解释 5xx/Console error 或产生数据残留。
- BLOCKED：缺少明确授权、外部配置、独占窗口或精确清理能力；写明责任方和解除条件。
- L1→L2→L3 顺序执行；L4 是共同发布门禁。
- 清理使用产品 API 逆序执行，只删除本次 runId 对象，核对 active/cleanup_failed 均为 0。
