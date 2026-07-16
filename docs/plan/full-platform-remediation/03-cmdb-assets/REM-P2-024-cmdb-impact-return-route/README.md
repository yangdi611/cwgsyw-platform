# REM-P2-024：CMDB 影响分析返回路由

- 优先级：P2；领域：CMDB；状态：`VERIFIED`
- 源：L4 `FQA_20260716_2300_lintfix`，`CMDB-039`。
- 问题：影响分析尚在加载时，返回实例链接使用 `_` 作为模型占位路由。
- 范围：仅在 `rootModelId` 可用时渲染返回详情链接；加载态禁止导航。
- 非目标：不变更 impact API、实例数据、权限或其他详情路径。
- 分支：`codex/rem-p2-024-cmdb-impact-return-route`，基线：`lint-fix@c8fd46a4`。
- 下一门禁：no-ff 合并后重跑 `CMDB-039` L4。

## 文件

- [SPEC.md](./SPEC.md)
- [VERIFICATION.md](./VERIFICATION.md)
- [IMPLEMENTATION-RECORD.md](./IMPLEMENTATION-RECORD.md)
- [CLAUDE-CODE-PROMPT.md](./CLAUDE-CODE-PROMPT.md)
