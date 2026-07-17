# REM-P2-032 实施合同

## 目标与不变量

工作台必须把变更文档列表 API 的响应归一化为数组后再执行列表派生。加载前、请求失败和分页 `records` 响应均不得使首页崩溃。保持现有 API、查询键、权限 guard 和显示口径不变。

## 当前与目标行为

- 当前：`safe(api.get('/change-docs'))` 返回后端分页对象；`docs ?? []` 未将其转换成数组，响应到达后 `docsList.filter` 运行时异常。
- 目标：查询函数只返回 `records` 数组；缺失或异常返回 `undefined`，既有空态保持可用。

## 修改范围

预计只修改 `frontend/src/app/(dashboard)/page.tsx` 的 `DashboardPage` 变更文档查询归一化。不得修改 Controller、服务、数据库、权限、审计或会话。

## 实施步骤

1. 将变更文档 query 的泛型和返回值对齐为分页 `records` 字段。
2. 保持同一 query key、相同 endpoint 和既有失败降级语义。
3. 运行最窄前端 typecheck/lint 与 Playwright 实际登录回归。

## 回滚与停止

回滚为本事件单文件提交即可。若 API 实际合同无 `records`、出现跨模块响应漂移或修复涉及后端/授权，停止并记录合同差异。

## 验收条件

| ID | 条件 |
|---|---|
| AC-001 | `GET /change-docs` 分页响应回填后首页不抛出 `.filter is not a function`。 |
| AC-002 | 指标仍以当前页 `records` 计数，空态与失败降级不白屏。 |
| AC-003 | superadmin 从登录页真实进入首页、可使用用户菜单登出，受保护首页随后回登录。 |
| AC-004 | 本事件不写入业务数据、权限、会话全局状态或任何非测试对象。 |
