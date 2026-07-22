# REM-P1-017：Wiki 资源授权、归属组与不存在语义

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-017` |
| 优先级 | P1 |
| 领域 | `04-content-files` |
| 状态 | `CLOSED` |
| 风险 | `CRITICAL` |
| 负责人 | Codex |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

Wiki 对不存在资源先返回空 403，页面 owner 无法在根页创建子页，platform 管理员默认主组创建空间失败，others mode bits 也未正确参与 ACL 裁决。

资源不存在、无权限和合法 owner 操作无法区分，授权矩阵会错误拒绝或掩盖真实状态。

## 追溯与边界

- 缺陷：`BUG-FQA-045`、`BUG-FQA-058`、`BUG-FQA-067`、`BUG-FQA-089`
- 用例：`WIKI-002`、`WIKI-006`、`WIKI-022`、`WIKI-023`、`P-045`、`P-046`、`P-047`
- 根因：Wiki resource adapter、统一 ResourceAccessService、ownerGroup 默认值与页面级 action 映射没有共享同一主体分类和存在性顺序。
- 原始证据：`defects.md` 对应章节和 `test-results/FQA_20260712_0329_lintfix/`；保持只读。

范围：
- 先确认资源存在性再执行不泄露的授权映射
- 明确 owner/named-user/matched-group/others effective bits
- 修复父页 create 与 ACL 继承
- 对齐 platform 管理员 ownerGroup 选择和后端裁决

非目标：
- 不绕过统一授权
- 不切换全租户授权模式
- 不修改非测试 Wiki ACL

L1-L3 已通过：管理员创建空间必须选组；组级会话固定当前组；不存在 Wiki 页面或空间返回 404 且前端不可操作；父页 owner 可创建子页；ACL others bits 正确回退。下一门禁：最终 L4 全平台复验。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
