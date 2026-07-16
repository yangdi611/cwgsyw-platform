# REM-P2-022：CMDB 影响分析循环去重

- 优先级：P2；领域：CMDB；状态：`VERIFIED`
- 源：L4 `FQA_20260716_2300_lintfix`，`CMDB-031`。
- 问题：CTE 在循环路径中将已经出现的实例重复放入更深层。
- 影响：影响分析结果不唯一，层级展示与路径语义失真。
- 范围：CTE 结果中每个实例仅保留首次（最短深度）出现；边集不变。
- 非目标：不变更关联、权限、实例、API 合同或历史数据。
- 分支：`codex/rem-p2-022-cmdb-impact-cycle-deduplication`，基线：`lint-fix@c4a7f25`。
- 下一门禁：no-ff 合并后重跑 `CMDB-031` L4。

## 文件

- [SPEC.md](./SPEC.md)
- [VERIFICATION.md](./VERIFICATION.md)
- [IMPLEMENTATION-RECORD.md](./IMPLEMENTATION-RECORD.md)
- [CLAUDE-CODE-PROMPT.md](./CLAUDE-CODE-PROMPT.md)
