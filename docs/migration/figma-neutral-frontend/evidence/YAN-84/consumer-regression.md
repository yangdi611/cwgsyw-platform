# Consumer Regression

- `/cmdb/instances/by-model/[modelCode]/[id]` now consumes Neutral Detail / Drawer.
- Isolated Neutral tests: `figma-neutral-m7-cmdb-instance-detail.test.cjs` 2/2 PASS.
- Impact / topology links, rack-only tab, topology permission filter, and instance query key are unchanged.
- Associations tab, topology tab internals, and standalone association/topology routes were not migrated in this slice.
