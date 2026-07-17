# REM-P1-033：变更文档编辑数据范围

- 优先级：P1；领域：流程与变更；状态：`VERIFYING`
- 来源：最终 L4 `FQA_20260716_2300_lintfix` 的 `CHANGE-008`。
- 已复现：组级 `member` 仅凭 `change_doc:read/update`，成功 HTTP 200 更新 superadmin 创建的同租户草稿。测试文档 #226、临时用户 #296 及其授权关系均已通过产品 API 删除，关键词回读为零。
- 已确认合同：普通成员仅本人；组长仅本组；`tenant` / `platform` scope 可访问全租户文档。越权资源不可枚举。
- 当前进度：服务层统一范围校验及产品 API 复验已完成。主代码编译和真实 member 越权回归通过；仓库既有无关测试源码编译错误阻断定向单测执行，待其恢复后补跑 L1 与完整角色矩阵再转 `VERIFIED`。

## 文件

- [SPEC.md](./SPEC.md)
- [VERIFICATION.md](./VERIFICATION.md)
- [IMPLEMENTATION-RECORD.md](./IMPLEMENTATION-RECORD.md)
- [CLAUDE-CODE-PROMPT.md](./CLAUDE-CODE-PROMPT.md)
