# REM-P1-057：Wiki 子页 owner group 继承

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-057` |
| 优先级 | P1 |
| 领域 | Wiki / Authorization resource initialization |
| 状态 | `VERIFIED` |
| 风险 | HIGH |
| 来源 | L4 `FQA_20260718_2050_remp1038` / `WIKI-024` |
| 分支 | `codex/rem-p1-057-wiki-child-owner-group-inheritance` |
| 基线 | `lint-fix@6559358f` |
| 失败快照 | `50332f17` |

平台 superadmin 没有主组。其在已有 Wiki 父页下创建子页时，默认 ACL 会复制，但资源初始化把 `owner_group_id` 写成空值，导致统一授权先返回 `RESOURCE_NOT_MIGRATED`，无法进入祖先 `x` 判定。本事件只修复已有父资源下的 owner-group 非空继承，保留显式组、setgid、默认 ACL、租户和授权模式合同。

L1-L3 已通过：owner-group 解析单测 4/4、受影响 Authorization/Wiki/Sharedfile 聚类 96/96、backend compile/build、当前事件镜像与健康容器、真实 Wiki allow/ancestor-deny/non-leak 1/1、共享目录生命周期 1/1；两个 manifest、关键词残留和 backend ERROR/5xx 均为零。

[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
