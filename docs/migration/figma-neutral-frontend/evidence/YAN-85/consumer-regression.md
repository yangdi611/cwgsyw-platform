# Consumer Regression

- Instance associations list now consumes Neutral Data / Management.
- Isolated Neutral tests: `figma-neutral-m7-cmdb-instance-associations.test.cjs` 2/2 PASS.
- Query keys `['cmdb-instance', modelCode, id]`, `['cmdb-rel', id]`, `['cmdb-association-defs]` unchanged.
- Delete still uses DELETE `/cmdb/instances/:id/relations/:relId`.
