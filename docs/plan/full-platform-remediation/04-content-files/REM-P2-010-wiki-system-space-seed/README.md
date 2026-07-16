# REM-P2-010：Wiki 系统手册与只读空间种子

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P2-010` |
| 优先级 | P2 |
| 领域 | `04-content-files` |
| 状态 | `VERIFIED`（等待最终 L4） |
| 风险 | `MEDIUM` |
| 负责人 | Codex |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

前后端支持 system/readOnly/writeScope 分层，但运行数据没有系统手册空间。

用户无法访问预期系统帮助，已实现只读分层无法验收。

## 追溯与边界

- 缺陷：`BUG-FQA-078`
- 用例：`WIKI-001`
- 根因：seed migration/初始化任务未创建或升级存量环境中的系统空间。
- 原始证据：`defects.md` 对应章节和 `test-results/FQA_20260712_0329_lintfix/`；保持只读。

范围：
- 建立幂等系统空间 seed
- 支持存量环境补数与版本标记
- 验证只读保护和个人排序不受影响

非目标：
- 不在代码中硬编码完整手册正文
- 不覆盖用户自建同名空间
- 不改变团队/个人空间语义

## 2026-07-16 L1-L3 结论

- 当前运行库已具备幂等 `WikiManualSeeder`：3 个系统空间、49 个已发布 seed 页面和 56 个 seed 版本；重启日志确认 0 页更新。
- 系统空间仍在 `/wiki` 的“官方手册”层置顶；只读空间创建页面返回 `403`、非空系统空间删除返回 `409`，页面 UI 无新建或编辑入口。
- 团队空间下移后刷新仍保留个人顺序，随后已恢复初始顺序；全程 Console error 为 0，未写入产品测试对象。
- GitNexus：`WikiManualSeeder.run` upstream 为 LOW、无直接调用者；`WikiSpaceService.hasWritePermission` 为 HIGH（24 直接调用者），本事件只验证既有拒绝语义，未修改该符号。

下一门禁：提交事件证据并按 `--no-ff` 合并到 `lint-fix`，随后进入 `REM-P2-011`。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
