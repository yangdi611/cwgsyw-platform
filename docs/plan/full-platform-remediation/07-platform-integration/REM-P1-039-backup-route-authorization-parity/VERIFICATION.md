# REM-P1-039 验证矩阵

| AC | 层级 | 验证 | 结果 |
|---|---|---|---|
| AC-001 | L1/L3 | 当前 `lint-fix` 容器、零权限浏览器直达 `/admin/backup` | PASS：`test/l4-admin-denial-current-run.spec.js`，`/tmp/rem-p1-039-route-before-retry` |
| AC-002 | L2/L3 | 最小权限身份的真实 API 拒绝 | PASS：`GET /api/backups`、创建及其他管理 API 均 `403` |
| AC-003 | L2/L3 | 管理员浏览器进入备份页与列表读取 | PASS：既有 `test/l4-backup-current-run.spec.js` `2/2`，`/tmp/fqa-2050-backup` |
| AC-004 | L2/L3 | 产品 API 逆序清理和 runId 零残留 | PASS：`REM_P1_039_20260718_2130/test-data-manifest.json` 为 `objects=[]`、`cleanupFailures=0` |

## 计划检查

- 无产品源码变更，因此没有重建容器或运行与变更无关的 lint/typecheck。
- Playwright：以 runId 零权限身份在当前 `lint-fix` 容器验证 API/UI 拒绝；已有 superadmin 备份生命周期证据覆盖允许路径；读取 manifest 证明清理。
