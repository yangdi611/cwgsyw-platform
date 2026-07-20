# 实施记录

## 2026-07-20：认领、影响与根因

- 从 `lint-fix@c6495ae9` 创建事件分支。
- 当前 run 真实 API 证明非法 URL 与空白 model 均返回 200；原 provider 字段和无 key 状态已恢复。
- DTO 无校验，Controller 未使用 `@Valid`，service 对非 null 字符串直接持久化。
- GitNexus 三个拟改符号均为 LOW。

## 2026-07-20：实现与验证

- Controller 启用 `@Valid`，DTO 限长，service 在写入前验证 HTTP(S) host、空白 URL/model 并规范化。
- Java 21 L1 3/3、L2 12/12、生产构建/健康和真实 API 1/1 通过。
- Provider 精确恢复；manifest 0/0，无未解释 ERROR/5xx。
