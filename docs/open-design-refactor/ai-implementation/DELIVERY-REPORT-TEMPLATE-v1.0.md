# 前端统一化 AI 交付与阻塞报告模板 v1.0

AI 每次结束一个工作包、暂停等待用户，或完成 Review/Acceptance，都应使用本模板的结构。内容可以简写，但不能省略证据状态。

## 1. 工作包交付报告

```text
日期：YYYY-MM-DD
工作包：WP-xx
状态：VERIFIED | IN_PROGRESS | BLOCKED | DEFERRED | NOT_RUN

目标与 finding：
- 本批目标：
- 解决的 finding：F-xx、F-xx

范围：
- 修改文件：
- 明确未修改：API / 权限 / 路由 / query keys / 数据库 / 状态机 / 领域工作区

影响分析：
- symbol：
- upstream impact：直接调用方、受影响流程、风险等级
- 高风险缓解：

静态验证：
- git diff --check：PASS | FAIL | BASELINE_FAIL | BLOCKED | NOT_RUN
- lint：PASS | FAIL | BASELINE_FAIL | BLOCKED | NOT_RUN
- typecheck：PASS | FAIL | BASELINE_FAIL | BLOCKED | NOT_RUN
- build：PASS | FAIL | BASELINE_FAIL | BLOCKED | NOT_RUN
- 相关测试：PASS | FAIL | BASELINE_FAIL | BLOCKED | NOT_RUN（若 `frontend/package.json` 没有 `test` script，必须写明 `NOT_RUN：package.json 无 test script`）

运行时与视觉证据：
- 入口和真实点击路径：
- 1440x900：PASS | FAIL | BLOCKED | NOT_RUN，证据位置/原因：
- 1024x768：PASS | FAIL | BLOCKED | NOT_RUN，证据位置/原因：
- 390x844：PASS | FAIL | BLOCKED | NOT_RUN，证据位置/原因：
- loading/error/empty/permission：

变更范围检查：
- detect_changes：文件数、symbol 数、affected flows、风险等级
- 未追踪文件限制或其他检测限制：

遗留风险与回滚：
- 未完成/阻塞：
- 回滚边界：
- 是否可以进入下一个工作包：是 | 否，原因：

下一步唯一建议：
```

## 2. 阻塞请求报告

```text
当前工作包：WP-xx
阻塞类型：登录态 | 浏览器 | 数据 | 端口 | 外部授权 | 用户修改冲突 | 其他

复现证据：
- 命令/路由/操作：
- 真实输出或截图位置：

已尝试措施：
- <填写已尝试措施>

影响：
- 哪些验收不能完成：
- 哪些不依赖阻塞的工作仍可继续：
- 是否阻止依赖工作包：是 | 否

推荐方案：
- <填写推荐方案>

需要用户做的最小决定：
- 提供授权测试条件，或
- 批准记录 DEFERRED，或
- 维持 BLOCKED 并停止当前工作包
```

不得把“缺少登录态”“浏览器不能自动化”“没有业务数据”写成测试通过。`DEFERRED` 必须包含用户授权、原因和重新验收触发条件。

## 3. Review 报告

按严重性优先输出真实 finding；每条至少包含：

```text
[P0/P1/P2] 标题
文件：/absolute/path/to/file.tsx:行号
问题：
影响：
证据：
建议：
```

没有 finding 时，仍需写明：已检查范围、运行过的命令、未覆盖的运行时路径和残余风险。

## 4. Acceptance 报告

按 `TEST-ACCEPTANCE-v1.0.md` 的 P0/P1/P2 逐项记录 `PASS`、`FAIL`、`BLOCKED` 或 `NOT_RUN`。结论只能是：

- `通过`：P0 全部通过，P1 无未解释失败，P2 已建账。
- `有条件通过`：P0 全部通过，P1 只有已授权且不影响核心使用的问题。
- `不通过`：任一 P0 失败，或存在行为回归、权限绕过、数据错误、页面不可用。
