# REM-P1-056 实施记录

## 2026-07-20：认领与根因确认

- 基线 `lint-fix@391663921`；分支 `codex/rem-p1-056-cmdb-attribute-canonical-action-guards`；failure snapshot `472b6ef2`；事件 runId `REM_P1_056_20260720`。
- L4 canonical-only tenant role 登录权限集明确含 `cmdb_attribute:create`，合法 runId 属性创建仍返回 403；全部 metadata/RBAC fixture 产品 API 清理为零。
- `permission-endpoint-matrix-v1.0.md` 已把属性 endpoint 标为 `[GD]` 并要求 canonical-only/legacy-only 差分；本修复执行既有批准合同，不新增产品语义。
- GitNexus：`CiAttributeController` LOW/0 upstream；`ModelDetailPage` LOW/0 upstream；`AttributeList` LOW/1 direct upstream/0 process。无 HIGH/CRITICAL 告警。
- 范围仅为属性 CRUD API guard 与模型属性页 action 显隐；关联、模型、import/impact/topology 不在本事件。

## 2026-07-20：实现与 L1-L3

- `CiAttributeController.list/create/update/delete` 分别改为 `cmdb_attribute:read/create/update/delete`；`ModelDetailPage` 与 `AttributeList` 拆分 read/create/update/delete，不再用 broad `canManage`。无 read 时不发属性请求并显示无权状态，其他三种控件独立显隐。
- 刷新 GitNexus 索引后对 Controller 类、四方法、`ModelDetailPage`、`AttributeList` 逐项 upstream impact：均 LOW、0 direct、0 affected process/module，无 HIGH/CRITICAL。
- L1：annotation contract PASS；touched-file ESLint、全量 TypeScript typecheck PASS。L2：Controller/attribute/model/metadata/VO 定向聚类 21/21 PASS；本机 Java 26 需 `-Dnet.bytebuddy.experimental=true` 兼容当前 Byte Buddy。
- L3：从当前事件分支构建 backend `sha256:dd9e5d6d...` 与 frontend `sha256:29c694ab...`，仅替换两个应用容器；backend healthy、actuator `UP`，PostgreSQL/Redis/MinIO/卷未重建或清理。
- 真实 Playwright `/tmp/rem-p1-056-playwright-r1` 1/1（15.4s）PASS：full canonical 四动作成功；四个逐项缺权身份 403；legacy-only 四动作 403；拒绝后属性数量和名称无副作用；六种真实页面控件显隐一致；pageerror/HTTP 5xx 为零。
- 角色、用户、assignment、属性、属性组、模型、模型组均通过产品 API 逆序精确清理；manifest `objects=[]`、`cleanupFailures=0`，runId 用户/角色/模型/模型组搜索均为 0。
- 全 CMDB 73 项中 63 PASS、10 ERROR，错误均为未触及 `CiChangeServiceTest.setUp:47` 的历史 strict Mockito unnecessary stub（blame `7c4fb5e71e`），不在属性权限影响链；不混入本事件修复。全量 frontend lint 0 error、39 条既有 warning。
- GitNexus all-changes detect：LOW，识别 Controller 类/四方法、`ModelDetailPage`、`AttributeList`/props 等 9 个变更符号，0 affected flow；与事件范围一致。`compare master` 为 CRITICAL、1,584 个累计文件、300 条流程，属于长期 `lint-fix` 集成差异，本事件以 `lint-fix@391663921` 基线和 staged detect 为边界。
