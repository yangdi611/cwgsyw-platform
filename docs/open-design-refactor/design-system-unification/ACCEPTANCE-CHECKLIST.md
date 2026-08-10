# Design System 合并验收清单 v1.0

## 静态门禁

- [ ] `git status --short --branch` 已记录，用户已有修改未被覆盖。
- [ ] 修改基础组件前已执行准确 symbol 的 GitNexus upstream impact。
- [ ] `git diff --check` 通过。
- [ ] `cd frontend && npm run lint` 通过且无新增 error。
- [ ] `cd frontend && npm run typecheck` 通过。
- [ ] `cd frontend && npm run build` 通过；没有 test script 时记录 `NOT_RUN`。
- [ ] `detect_changes()` 的变更符号和执行流符合当前批次范围。

## 组件行为

- [ ] Button 的 variant、size、disabled、loading 尺寸稳定。
- [ ] Input、Textarea、Select 的 value、onChange、name、id 和错误状态兼容。
- [ ] Dialog/AlertDialog 的焦点、Escape、遮罩关闭和内部滚动正确。
- [ ] Checkbox、Switch 的键盘和 aria 状态正确。
- [ ] Table 不撑破页面，宽表使用内部滚动。
- [ ] Dark mode 和 `--v2-*` token 正常。

## 业务回归

- [ ] API、DTO、query key、分页、筛选和 URL 参数未改变。
- [ ] 权限判断、重定向和无权限页面未改变。
- [ ] 保存、提交、发布、归档、删除和审批状态机未改变。
- [ ] Wiki、BPMN、React Flow、空间布局、文件预览和编辑器领域交互未改变。

## 运行时与视觉

- [ ] 代表页面从真实入口或授权登录态进入，而不是只打开 URL。
- [ ] 覆盖 loading、error、empty、permission denied、主操作和返回。
- [ ] `1440x900` 无双滚动、遮挡和不必要空白。
- [ ] `1024x768` 无横向溢出，操作区仍可达。
- [ ] `390x844` 文本、按钮、Dialog 和表格不被截断。
- [ ] 记录截图或等价浏览器证据。

## 状态规则

- `VERIFIED`：静态、行为、运行时和最低 viewport 证据齐全。
- `PASS`：单项检查通过，不代表整个工作包完成。
- `BLOCKED`：缺少登录态、业务数据或环境能力，不能伪造通过。
- `NOT_RUN`：命令或场景没有执行，必须说明原因。
- `DEFERRED`：只有用户明确授权并记录重新验收条件后使用。
