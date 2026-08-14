# Rollback

全部改动仍在 `/Users/byron/AI/worktrees/YAN-71` 未提交工作区。

若要丢弃本轮 leftover token 清理，只回滚这些文件即可，不要重置整棵脏树：

- `frontend/src/app/globals.css`
- leftover chrome 组件和 layout
- `frontend/test/figma-neutral-m8-leftover-tokens.test.cjs`

基线 SHA 仍是 `cd983965e`。
