# REM-P2-025：CMDB 拓扑循环安全

- 优先级：P2；领域：CMDB；状态：`VERIFIED`
- 源：L4 `FQA_20260716_2300_lintfix`，`CMDB-029`。
- 问题：实例 `#20` 的拓扑读取在 `depth=1` 与 `depth=2` 返回 HTTP 500；双向关系递归会立即回走，CTE 没有已访问节点保护。
- 范围：仅让拓扑递归在单一展开路径内不重复访问实例，确保有限深度读取与 compare 重建稳定返回。
- 非目标：不变更关联、实例、权限、返回字段、深度钳制、历史审计或非测试数据。
- 分支：`codex/rem-p2-025-cmdb-topology-cycle-safety`，基线：`lint-fix@3ecd2b7a7`。
- 下一门禁：no-ff 合并后在新集成基线重跑受影响 L4 `CMDB-029`。

## 文件

- [SPEC.md](./SPEC.md)
- [VERIFICATION.md](./VERIFICATION.md)
- [IMPLEMENTATION-RECORD.md](./IMPLEMENTATION-RECORD.md)
- [CLAUDE-CODE-PROMPT.md](./CLAUDE-CODE-PROMPT.md)
