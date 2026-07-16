# REM-P2-001：动态资源不存在与错误态收敛

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P2-001` |
| 优先级 | P2 |
| 领域 | `08-cross-cutting-contracts` |
| 状态 | `VERIFIED` |
| 风险 | `LOW` |
| 负责人 | Codex |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

文件、CMDB 影响分析、设备和 IPAM 动态路由在资源不存在时永久 loading、显示框架错误页或留下 Console error。

用户无法区分加载中、无权限和资源已不存在。

## 追溯

- 缺陷：`BUG-FQA-009`、`BUG-FQA-042`、`BUG-FQA-043`
- 用例：`AUTH-009`、`P-042`、`CMDB-032`、`DEVICE-001`、`IPAM-001`、`COMMON-012`
- 原始记录：`docs/acceptance/full-platform-exhaustive-functional-test-v1.0/runs/FQA_20260712_0329_lintfix/defects.md`
- 原始证据：`test-results/FQA_20260712_0329_lintfix/` 下对应 case 目录；原证据保持只读。

## 边界

根因聚类：页面 query error 分支不完整，后端不存在合同在 400/403/404 之间漂移。

范围：
- 定义统一 not-found/forbidden/error 映射
- 所有相关页面结束 loading 并显示可恢复错误态
- 消除预期 4xx 的未解释 Console 噪音

非目标：
- 不改变资源授权判定
- 不恢复已删除资源
- 不统一改造全部动态路由

事件级 L1-L3 已通过；下一门禁为发布候选版全量 L4 复验。

文件导航：[SPEC](./SPEC.md) / [验证矩阵](./VERIFICATION.md) / [实施记录](./IMPLEMENTATION-RECORD.md) / [执行 Prompt](./CLAUDE-CODE-PROMPT.md)
