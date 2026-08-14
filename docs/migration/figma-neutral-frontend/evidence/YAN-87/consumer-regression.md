# Consumer Regression

YAN-87 leftover chrome 已改到 Neutral。隔离测试：

- `figma-neutral-m8-leftover-consumers.test.cjs`
- 连带 `cmdb-instance-detail` / `cmdb-instance-list` / `spatial` / `home` / `wiki` 均 PASS

业务代码不再 import `@/components/design-system`。
