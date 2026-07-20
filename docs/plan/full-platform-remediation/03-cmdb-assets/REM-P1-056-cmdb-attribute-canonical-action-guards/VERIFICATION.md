# REM-P1-056 验证矩阵

| AC | 层级 | 结果 | 证据 |
|---|---|---|---|
| `AC-001` | L1 | PASS | `CiAttributeControllerAuthorizationTest`：四方法精确 canonical guard |
| `AC-002` | L1-L3 | PASS | full identity 四动作成功；分别缺 read/create/update/delete 均 403 且无副作用 |
| `AC-003` | L2-L3 | PASS | legacy-only `cmdb_model:read/update` 对四属性 API 均 403，属性保持原值 |
| `AC-004` | L3 | PASS | 六个真实身份逐一登录；读取、新建、编辑、删除控件按四 action 独立显隐 |
| `AC-005` | L3 | PASS | 双镜像 build、backend healthy/UP、Playwright 1/1、Console/pageerror/5xx=0、manifest/关键词均零 |

原始 L4 失败：`test/l4-cmdb-attribute-canonical-guard-current-run.spec.js` 在 `/tmp/fqa-2050-cmdb014-attribute-guard-r3` 以合法 payload 得到 403；failure snapshot `472b6ef2`。

事件证据：`test/rem-p1-056-cmdb-attribute-canonical-action-guards.spec.js`，输出 `/tmp/rem-p1-056-playwright-r1`，1/1 PASS（15.4s）。`test-data-manifest.json` 最终 `objects=[]`、`cleanupFailures=0`；产品 API 搜索 runId 的 users/roles/models/modelGroups 均为 0。

L2 定向聚类在 `-Dnet.bytebuddy.experimental=true` 下 21/21 PASS。全 CMDB 73 项中 63 PASS、10 ERROR；错误全部来自未修改 `CiChangeServiceTest.setUp:47` 的历史 unnecessary stub（blame `7c4fb5e71e`），不在本事件影响链。全量 frontend lint 为 0 error、39 个既有 warning；typecheck 与 touched-file lint 均 PASS。
