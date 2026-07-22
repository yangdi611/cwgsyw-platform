# 最终 L4 缺陷台账

本轮发现真实 FAIL 时立即登记，停止最终关闭流程并创建独立 REM 事件。

## L4-DASHBOARD-001：变更文档列表响应回填使工作台崩溃

| 项目 | 结论 |
|---|---|
| 严重度 | P2 |
| 用例 | `AUTH-001` / B1 |
| 账号与授权 | `superadmin`；未修改权限、membership 或授权模式 |
| 复现 | 真实 `/login` 登录后进入 `/`，等待变更文档列表请求完成 |
| 预期 | 首页稳定可用，可继续导航和退出登录 |
| 实际 | 初始页面短暂渲染，随后错误边界显示；page error：`_.filter is not a function` |
| 根因 | 首页将 `/change-docs` 的分页对象当作数组并调用 `.filter` |
| 数据污染 | 无业务写入、无测试对象、无全局会话操作 |
| 修复范围 | 独立 `REM-P2-032`，仅工作台变更文档列表响应归一化 |
| 首次证据 | 浏览器 stack 指向 `app/(dashboard)/page` chunk；修复后证据为 `test-results/FQA_20260717_1125_final_l4/REM-P2-032/` |
