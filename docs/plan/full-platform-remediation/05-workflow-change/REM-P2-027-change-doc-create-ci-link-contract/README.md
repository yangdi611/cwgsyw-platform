# REM-P2-027：变更文档创建 CI 关联合同

- 优先级：P2；领域：变更文档；状态：`VERIFIED`
- 来源：最终 L4 `FQA_20260716_2300_lintfix`，`CHANGE-002`。
- 问题：新建页可选择 CI 并提交 `ciSnapshots`，但创建 DTO/服务忽略该字段，草稿创建后没有 CI 链接。
- 用户影响：用户以为已关联受影响资产，详情和 CI 资源页却看不到该变更，影响变更追踪完整性。
- 分支：`codex/rem-p2-027-change-doc-create-ci-link-contract`，基线：`lint-fix@cc2a8ed4`。
- 范围：创建请求接收 CI 选择；同一事务内校验同租户实例、写入去重关联；失败回滚草稿。
- 非目标：不改变既有链接 API、模板、审批、导出、权限、CI 模型或历史文档。
- 验证结论：L1 后端打包、前端 typecheck/lint 通过；L2 空 CI、非法 CI 回滚和零残留通过；L3 真实页面创建、CI 回读与清理通过。
- 下一门禁：no-ff 合并后从最新 `lint-fix` 重跑 L4 `CHANGE-002`。

## 文件

- [SPEC.md](./SPEC.md)
- [VERIFICATION.md](./VERIFICATION.md)
- [IMPLEMENTATION-RECORD.md](./IMPLEMENTATION-RECORD.md)
- [CLAUDE-CODE-PROMPT.md](./CLAUDE-CODE-PROMPT.md)
