# YAN-91 leftover: CMDB search dropdowns

Combobox 只能过滤本地 `options`，接不上 `/cmdb/instances/search` 异步搜索。因此没有整页换成 Combobox，也没有改 queryKey / 查询语义。

改动：

- `CiInstanceSelect` 已选行改走 `cwgsyw-control`
- `CiInstanceSelect` / `CiLinkSelector` 菜单改走 `cwgsyw-listbox cwgsyw-listbox--overlay`
- `CiLinkSelector` 已选 chip 改走 `cwgsyw-chip` + `cwgsyw-inline-controls`
- overlay 高度用已有 `--cwgsyw-control-height-md`，没有发明新 token

证据：`frontend/test/figma-neutral-m8-leftover-search-dropdowns.test.cjs`
