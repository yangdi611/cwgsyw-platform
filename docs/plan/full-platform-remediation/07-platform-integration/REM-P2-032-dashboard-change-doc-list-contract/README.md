# REM-P2-032：工作台变更文档列表响应合同

| 项目 | 值 |
|---|---|
| 状态 | `VERIFIED` |
| 优先级 | P2 |
| 领域 | 平台与集成 / 工作台 UI |
| 分支 | `codex/rem-p2-032-dashboard-change-doc-list-contract` |
| 基线 | `lint-fix@de196e8275a8a8891e119e9fa64c75c9cd49d5e3` |
| 来源 | 最终 L4 `FQA_20260717_1125_final_l4` / `AUTH-001` |

## 问题与影响

登录后首页将 `GET /change-docs` 的分页对象当作数组。初始空数据可渲染，但查询回填后调用 `.filter()` 导致工作台错误页，用户不能继续导航、退出登录或使用任何首页入口。

## 范围

- 仅修复工作台对变更文档列表响应的归一化读取。
- 覆盖初始空态、分页 records 回填、可见指标和无控制台异常。

不修改后端列表 API、权限模型、变更文档数据或非测试对象。

## 风险与下一门禁

GitNexus 对 `DashboardPage` 的 upstream 分析：0 个直接调用者、1 个工作台流程、`LOW`。L1 typecheck/lint、L2 分页 `records` 归一化与 L3 当前分支前端容器 Playwright 登录-首页-退出复验均已通过；事件为 `VERIFIED`，待提交和 `--no-ff` 合并后恢复最终 L4。

## 文件导航

- [SPEC.md](./SPEC.md)：实施和验收合同
- [VERIFICATION.md](./VERIFICATION.md)：L1-L3 证据矩阵
- [IMPLEMENTATION-RECORD.md](./IMPLEMENTATION-RECORD.md)：追加式执行记录
- [CLAUDE-CODE-PROMPT.md](./CLAUDE-CODE-PROMPT.md)：事件执行入口
