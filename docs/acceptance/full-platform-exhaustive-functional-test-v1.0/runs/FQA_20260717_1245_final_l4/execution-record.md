# 最终 L4 执行记录

## Phase 0：环境冻结

## Phase 0.2：REM-P0-004 集成后恢复

- 旧的 `148ebe16` 基线已被 `REM-P0-004` 合并提交 `039502b4` 取代；本最终 L4 分支从该集成点创建。
- 当前 backend 由该分支构建并以 `AUTHORIZATION_DECISION_MODE=SHADOW` 运行，health=`UP`。
- strict preflight 已由 `REM-P0-004` 运行时复验确认 `latestDecisionDiffs=0`、`unobservedPermissionGrants=0`、`eligible=true`；旧 `PENDING_BYRON_CREDENTIAL` 记录仅是历史事实，不再是本轮 gate。
- 未执行 Enforce、Rollback、break-glass 或任何非测试 ACL/角色/assignment 写入。下一步从认证与权限夹具门禁恢复 275+78 矩阵。

- 分支 `codex/fqa-final-l4-revalidation-2` 从最新 `lint-fix@148ebe16` 创建；工作区干净。
- backend health 为 `UP`，已有开发数据服务未重建或清空。
- 浏览器使用独立 Playwright Chromium；主流程从真实 `/login` 开始。

## B1：AUTH-001

- `superadmin` 正确登录后首页稳定，等待 2 秒确保变更文档列表回填完成。
- 用户菜单登出后访问受保护首页正确回到登录页。
- 零 page/console error、零失败请求、零业务写入。证据：`test-results/FQA_20260717_1245_final_l4/AUTH-001/result.json`。

## B1：AUTH-003 / HOME-003 / HOME-007

- `AUTH-003`：错误密码、空用户名、空密码、不存在用户均停留登录页并显示拒绝状态，零 page error。
- `HOME-003`：管理员可见侧栏共 35 条入口逐条真实导航，均正常渲染且无错误边界。
- `HOME-007`：`1440x1000`、`1024x768`、`390x844` 三档首页无横向溢出；本批零 console/page error。
- 证据：`test-results/FQA_20260717_1245_final_l4/AUTH-003/result.json`、`test-results/FQA_20260717_1245_final_l4/HOME-003-007/result.json`。

## B1：HOME-004 / HOME-006

- `HOME-004`：真实首页 `⌘K` 打开命令面板；精确无结果显示“未找到匹配结果”，Escape 后弹窗卸载；关键词“变更”有 6 条结果，零错误。
- `HOME-006`：从变更文档页进入 CMDB，浏览器后退、前进和刷新均保留预期路由，无 console/page error。
- 证据：`test-results/FQA_20260717_1245_final_l4/HOME-004-006/palette-result.json`、`history-result.json`。

## B1：HOME-005

- 从首页页头铃铛真实进入通知中心；`/api/notifications/unread-count` 与 `/api/notifications?page=1&size=50` 均为 200。
- 页面正常渲染，零 console/page error。证据：`test-results/FQA_20260717_1245_final_l4/HOME-005/result.json`。

## B1：HOME-008

- 从真实登录会话的用户菜单切换浅色、深色；`html` 主题状态准确切换，刷新后深色偏好保持。
- 深色状态下依次打开综合报表、知识库和流程设计；三个页面均可读、无登录回跳、零 console/page error、零失败请求。
- 证据：`test-results/FQA_20260717_1245_final_l4/HOME-008/result.json`。

## B1：HOME-002

- 以真实首页卡片和快捷入口逐一点击运维日历、CMDB 概览、变更新建、流程任务及身份与权限。
- 所有目标路由、页面标题与内容均符合入口含义；零 console/page error、零失败请求。
- 证据：`test-results/FQA_20260717_1245_final_l4/HOME-002/result.json`。

## B2：CMDB-035 / CMDB-036

- 在真实变更历史页面验证关键字筛选：不存在关键字返回 `total=0/records=0`，清除后恢复全量 `total=236`；页面保留模型、日期、操作人、关键字和动作筛选控件及变更统计入口。
- 统计页默认范围返回趋势和 Top 10；明确的未来空范围使 today/week/month、趋势和 Top 10 均归零/空，不再混入当前期汇总。
- 两页均由真实登录会话访问，零 console/page error、零失败请求、零业务写入。证据：`test-results/FQA_20260717_1245_final_l4/CMDB-035-036/result.json`。

## 授权门禁观测：AUTHZ-003

- 真实工作台页面、cutover 状态与严格 preflight API 同口径：当前为 `enforced`、epoch `2`，pending user/open exception 均为 `0`。
- 严格预检明确呈现并定位唯一阻断 `SHADOW_COVERAGE_INCOMPLETE`：`unobservedPermissionGrants=5`，无 permission diff；UI 与 API 均可见。
- 本用例仅观测，未执行 backfill、Shadow、Rollback 或 Enforce。证据：`test-results/FQA_20260717_1245_final_l4/AUTHZ-003/result.json`。

## 授权模式读取：AUTHZ-016

- 真实登录后 Wiki 与共享文件页面均读取到 `state=enforced`、`enforced=true`、`useUnifiedEditor=true`。
- 以同一真实会话发起的非法 module 请求返回明确 HTTP 400；正常页面零 console/page error、零失败请求。
- 证据：`test-results/FQA_20260717_1245_final_l4/AUTHZ-016/result.json`。

## B8：REPORT-002

- 从真实报表页面设置日期范围并导出，下载文件名为中文 `日报汇总_2026-07-01_2026-07-17.xlsx`，文件非空。
- 页面日期和按组筛选入口正常，零 console/page error、零失败请求；本用例是只读导出，未创建或变更业务对象。
- 证据：`test-results/FQA_20260717_1245_final_l4/REPORT-002/result.json`。

## B8：NOTICE-002

- 从真实通知中心读取 32 条通知并验证其目标解析：可访问 Wiki 目标返回正确业务路由；已删除或不可访问的 Wiki/运维任务目标统一返回不可用状态，而不泄露资源细节。
- 目标入口由页面链接与权限感知 API 一致提供，零 console/page error、零失败请求，未改变通知已读状态。
- 证据：`test-results/FQA_20260717_1245_final_l4/NOTICE-002/result.json`。

## B8：REPORT-001

- 综合报表页面的正常日期范围与快捷范围入口正常；反向日期在 UI 中被拒绝且未发出导出请求。
- 明确未来空范围可下载结构正确的非空 XLSX，返回中文 UTF-8 文件名；零 console/page error、零失败请求。
- 证据：`test-results/FQA_20260717_1245_final_l4/REPORT-001/result.json`。

## B5：FILE-001 / FILE-006 / FILE-007

- 真实共享文件页返回 6 个可见文件夹、13 条文件；不存在关键字返回精确空结果并呈现空态，文件夹树、列表和搜索可导航。
- 选取可访问文本文件，通过真实预览页验证详情与内联内容均为 200；从页面下载的文件名和字节数与文件记录一致。
- 全程零 console/page error、零失败请求、零业务写入。证据：`test-results/FQA_20260717_1245_final_l4/FILE-001/result.json`、`FILE-006-007/result.json`。

## B4：DEVICE-001 / IPAM-001

- 设备库读取到 2 条设备；不存在关键字显示明确空态，首条设备详情 API 与列表可用数据一致。
- IP 地址池当前无可见记录；列表与不存在关键字均返回精确空分页，页面搜索和空态正常。
- 两个模块零 console/page error、零失败请求、零业务写入。证据：`test-results/FQA_20260717_1245_final_l4/DEVICE-001/result.json`、`IPAM-001/result.json`。

## B3：OPS-001 / OPS-002

- 真实侧栏进入运维日历；读取权限入口、范围筛选与“今天”控件可用。
- 月、周、列表三种视图分别请求正确日期区间，并返回同一现有任务集合；零 console/page error、零失败请求、零业务写入。
- 证据：`test-results/FQA_20260717_1245_final_l4/OPS-001-002/result.json`。

## B6：CHANGE-001

- 真实变更文档页显示现有 draft/approved 状态、状态筛选入口和分页列表；不存在关键词返回精确空结果。
- 首条文档详情与列表的标题和状态一致；零 console/page error、零失败请求、零业务写入。
- 证据：`test-results/FQA_20260717_1245_final_l4/CHANGE-001/result.json`。

## B6：WIKI-001 / WIKI-022

- 知识库空间列表读取到 8 个已授权空间，首个只读空间标识正确；进入空间树和既有页面均返回 200。
- 不存在页面以明确 `404/RESOURCE_NOT_FOUND` 返回，浏览器页面无 console/page error 或失败请求。
- 证据：`test-results/FQA_20260717_1245_final_l4/WIKI-001-022/result.json`。

## B7：FLOW-003 / FLOW-004

- 待办中心的我的/组范围和兼容任务页的组待办均返回 200、任务集合一致的空态。
- 流程实例页的运行中/已完成实例查询正常；读取已完成实例活动历史返回 3 条记录，状态与历史可追溯。
- 全程零 console/page error、零失败请求、零业务写入。证据：`test-results/FQA_20260717_1245_final_l4/FLOW-003-004/result.json`。

## B8：AUDIT-001

- 真实审计页加载 10,263 条可见租户审计记录的首个分页，并提供模块、动作、操作人、日期及关键字筛选控件。
- 不存在关键字和不存在动作均返回精确空分页；零 console/page error、零失败请求、零业务写入。
- 证据：`test-results/FQA_20260717_1245_final_l4/AUDIT-001/result.json`。

## 补充只读覆盖：用户与用户组

- 用户管理页读取 17 个账号，首个账号详情和 group-membership 均返回 200；用户组页读取 7 个组，首组成员读取返回 200。
- 此证据只覆盖读取链路，`RBAC-001`/组生命周期的创建、编辑、软删除与清理合同仍需后续 runId 夹具完整验证，因此不计入主功能 PASS。
- 证据：`test-results/FQA_20260717_1245_final_l4/RBAC-001-read/result.json`、`RBAC-READ-ONLY/groups-result.json`。

## B5：CMDB-001 / CMDB-002

- CMDB 概览真实加载 18 个模型和 7 个模型组；实例浏览读取 9 条实例，详情可读，不存在关键字返回精确空结果。
- 兼容入口 `/cmdb/instances` 仅重定向到 `/cmdb`，没有循环；零 console/page error、零失败请求、零业务写入。
- 证据：`test-results/FQA_20260717_1245_final_l4/CMDB-001-002/result.json`。

## B7：DAILY-001

- 日报日历以“全部日报”范围正常加载；前后月份请求均返回正确的空分页，日历、状态图例和日期网格可用。
- 当前环境在相邻月份没有可读日报，因而本轮只验证零数据范围与视图状态，不以空环境虚构详情或状态转换结论。
- 零 console/page error、零失败请求、零业务写入。证据：`test-results/FQA_20260717_1245_final_l4/DAILY-001/result.json`。

## B5：CMDB-033

- 告警中心在当前零告警环境中正常返回空分页；critical/warning/info 三种级别和无效状态筛选均返回同口径的精确空结果。
- 页面级别/状态筛选入口可见，零 console/page error、零失败请求、零业务写入。
- 证据：`test-results/FQA_20260717_1245_final_l4/CMDB-033/result.json`。

## B8：REPORT-003

- 流程统计页返回 4 个流程定义；汇总的启动/运行/完成数为 `4/0/4`，与运行中和已完成实例列表的总数严格一致。
- CMDB 聚合口径复用本 run 已通过的 `CMDB-036` 默认范围和未来空范围证据；全程零 console/page error、零失败请求、零业务写入。
- 证据：`test-results/FQA_20260717_1245_final_l4/REPORT-003/result.json`、`CMDB-035-036/result.json`。

## 补充只读覆盖：备份恢复

- 备份页读取 4 条记录；选择恢复仅显示不可逆警告与“取消/确认恢复”双按钮，随后取消，未发送任何非 GET 备份请求。
- 这只证明读取与取消路径，不能替代 `BACKUP-001` 的创建/下载或 `BACKUP-004` 的受控恢复验收，因此不计入主功能 PASS。
- 证据：`test-results/FQA_20260717_1245_final_l4/BACKUP-READ-ONLY/result.json`。

## 状态矩阵：ST-AUTHZ-019

- 使用错误确认词 `enforce` 调用 Enforce，服务端在确认词校验阶段明确返回 400，未进入切换逻辑。
- 前后 cutover 均为 `enforced/epoch=2`；严格预检仍为 `eligible=false`、未观测授权数仍为 5，证明状态、epoch 与门禁不变。
- 证据：`test-results/FQA_20260717_1245_final_l4/ST-AUTHZ-019/result.json`。

## 补充只读覆盖：AI 与系统配置

- AI 网关读取 3 个供应商；返回字段不含 API Key，页面使用对应的 password 输入作为掩码编辑入口，且零非 GET AI 配置请求。
- 系统配置读取到 19 个键；当前 `smtp.password` 字段长度为 0，确认未配置 SMTP 密码而非密码泄露。配置页密码输入及四个配置页签可用，零非 GET 配置请求。
- 两项均不替代各自的写入生命周期、外部连接或恢复主用例。证据：`test-results/FQA_20260717_1245_final_l4/AI-READ-ONLY/result.json`、`CONFIG-READ-ONLY/result.json`。

## B5：CMDB-039

- 从概览进入实例浏览，基于既有实例 `#32` 的模型路径进入真实详情；详情面包屑返回“实例列表”，回退后路由正确。
- 列表与详情均正常渲染，零 console/page error、零失败请求、零业务写入。
- 证据：`test-results/FQA_20260717_1245_final_l4/CMDB-039/result.json`。

## B5：CMDB-031

- 对既有实例 `#32` 执行 upstream、downstream 与 bidirectional 影响分析；三种方向均返回 200、方向回显正确、根层存在且无截断。
- upstream/bidirectional 各有一条真实边，downstream 为空图保持正常；零 console/page error、零失败请求、零业务写入。
- 证据：`test-results/FQA_20260717_1245_final_l4/CMDB-031/result.json`。

## B6：WIKI-017

- 对既有页面与空间执行只读导出：页面 API 返回非空 Markdown，空间 API 返回非空 ZIP；页面 UI 下载保留当前中文标题和 Markdown 扩展名。
- 全程零 console/page error、零失败请求、零业务写入。
- 证据：`test-results/FQA_20260717_1245_final_l4/WIKI-017/result.json`。

## B6：WIKI-014

- 对既有知识空间 `#6` 执行只读图谱验证。图谱 API 返回 29 个节点、0 条边；页面图谱正常渲染，点击图谱节点后准确进入 `/wiki/6/86`。
- 全程零 console/page error、零失败请求、零业务写入，结算 PASS。证据：`test-results/FQA_20260717_1245_final_l4/WIKI-014/result.json`。

## B6：WIKI-013

- 以既有可读页面验证搜索 API：`Release` 返回 2 条结果，唯一无匹配关键字返回精确空分页；页面搜索、空态、结果点击与浏览器后退/前进均保持正确 URL 和目标页。
- 零 console/page error、零业务写入。导航切换中三个被浏览器取消的旧 RSC/初始化 GET 请求单列为预期导航取消，未出现业务失败，结算 PASS。证据：`test-results/FQA_20260717_1245_final_l4/WIKI-013/result.json`。

## B5：CMDB-029

- 对既有实例 `#32` 执行只读拓扑验证：API 返回根节点、2 个节点和 1 条边，图谱页面正常渲染。
- 零 console/page error、零业务写入。唯一取消请求是框架对 `/compare` 子路由的 RSC 预取，单列为预期预取取消，未出现业务失败，结算 PASS。证据：`test-results/FQA_20260717_1245_final_l4/CMDB-029/result.json`。

## B5：CMDB-030

- 使用实例 `#32` 的两个历史时间点执行只读拓扑对比。API 返回新增 2、删除 2、修改 0、未变 0 及 1 条关系差异；页面对比标题、四类图例和图谱全部正常。
- 零 console/page error、零业务写入；一条框架导航取消请求已单列，未出现业务失败，结算 PASS。证据：`test-results/FQA_20260717_1245_final_l4/CMDB-030/result.json`。

## B7：FLOW-001

- 统一待办中心 API 与 UI 的“我的待办”“组待办”范围均返回当前 0 条任务，页面准确展示零任务空态。
- 零 console/page error、零失败请求、零业务写入，结算 PASS。证据：`test-results/FQA_20260717_1245_final_l4/FLOW-001/result.json`。

## B7：FLOW-013

- 流程统计 API 返回 4 个定义；每条统计的启动总数严格等于运行中与已完成之和，页面统计卡片正常渲染。
- 零 console/page error、零失败请求、零业务写入，结算 PASS。证据：`test-results/FQA_20260717_1245_final_l4/FLOW-013/result.json`。

## B8：NOTICE-001

- 通知 API 的第一页、第二页总数均为 32（20 + 12）；未读数为 0，与第一页未读记录数一致，通知页正常渲染。
- 未调用标记已读或全部已读接口。网络唯一 POST 是正常会话登录协议，已与业务写入分离；零 console/page error、零失败请求，结算 PASS。证据：`test-results/FQA_20260717_1245_final_l4/NOTICE-001/result.json`。

## B6：WIKI-016

- 既有页面的版本历史接口返回 1 个版本且顺序正确；页面版本面板正常展开，Markdown 导出返回非空内容。
- 未点击回滚。RSC 预取取消与认证/会话保活 POST 已与业务写入分离；零 console/page error、零业务写入，结算 PASS。证据：`test-results/FQA_20260717_1245_final_l4/WIKI-016/result.json`。

## B9：AUTHZ-001

- 在已批准的 Shadow 观测窗口中，迁移工作台 UI/API 同步显示 configured/effective mode 为 `shadow`，而持久 cutover 状态保持 `enforced/epoch=2`；严格预检仍准确显示 5 条未观测授权和阻断状态。
- 未执行任何 migration、Rollback、Enforce 或 break-glass 写入。认证登录 POST 已与业务写入分离；零 console/page error、零失败请求，结算 PASS。证据：`test-results/FQA_20260717_1245_final_l4/AUTHZ-001/result.json`。

## B5：CMDB-018

- 既有 resource pool 实例 `#32` 的基本信息、关联关系、拓扑图、变更历史、告警和关联资源六个详情标签均正常加载。
- 认证/会话保活协议 POST 已与业务写入分离；零 console/page error、零业务写入，结算 PASS。证据：`test-results/FQA_20260717_1245_final_l4/CMDB-018/result.json`。

## B5：CMDB-015

- 从当前模型 API 读取 18 个模型，逐个通过真实 UI 打开实例列表；全部正常呈现列表或精确空态。
- 认证登录 POST 已与业务写入分离；零 console/page error、零业务写入，结算 PASS。证据：`test-results/FQA_20260717_1245_final_l4/CMDB-015/result.json`。

## B8：OPS-018

- 运维统计在当前日期范围返回总数 1，状态分布合计同为 1；未来日期范围返回精确零聚合。页面日期筛选能够触发对应统计重读。
- 认证/会话保活协议 POST 已与业务写入分离；零 console/page error、零业务写入，结算 PASS。证据：`test-results/FQA_20260717_1245_final_l4/OPS-018/result.json`。

## B8：OPS-019

- 读取当月报表素材归集并导出 Excel，接口返回非空 XLSX 和带 UTF-8 中文文件名的 attachment disposition；素材归集页入口与导出按钮均正常可见。
- 认证登录 POST 已与业务写入分离；零 console/page error、零业务写入，结算 PASS。证据：`test-results/FQA_20260717_1245_final_l4/OPS-019/result.json`。

## B1：动态/二级只读路由

- 29 条 CMDB、变更文档、资源、Wiki、日报、Workflow、通知、运维日历与报表路由均以真实登录会话打开，HTTP 200、无错误边界、无登录回跳、零 console/page error。
- 这是 B1 页面覆盖的补充证据，不把多个路由误计为额外主功能用例。证据：`test-results/FQA_20260717_1245_final_l4/B1-dynamic-routes/result.json`。

## 授权门禁暂停

- 切换前只读快照：cutover 为 `enforced`、epoch `2`、pending/open exceptions 均为 `0`；strict preflight 因 `SHADOW_COVERAGE_INCOMPLETE=5` 不可通过。
- 该 5 条阻断来自既有 Wiki/共享文件 legacy grant 尚无 Shadow 决策观测。用户已授权短暂 Shadow 观测及全租户 `Rollback -> preflight -> Enforce`。
- 当前唯一待补输入为既有 `byron` 账号当前密码；未经明确授权，不重置既有账号密码。在此输入到位前，未执行 Shadow、Rollback、Enforce、break-glass、临时角色/账号/membership/assignment 创建或任何非测试对象修改。证据：`test-results/FQA_20260717_1245_final_l4/AUTHZ-snapshot/before.json`、`workbench.json`。

## Phase 1：REM-P0-004 后授权判定 API 复验

- 当前集成基线 `039502b4` 的真实 superadmin 会话读取到 configured/effective mode 均为 `shadow`；持久字段 `cutoverStatus=enforced`、`epoch=2` 仅表示先前切换记录，不能替代有效模式，更不表示本轮执行了 Enforce。
- strict preflight 的 `eligible=true`，所有 blocker 计数、`latestDecisionDiffs` 与 `unobservedPermissionGrants` 均为 `0`，`issues`、`permissionDiffs` 均为空，确认 REM-P0-004 已处理 8 条历史判定差异及陈旧测试观测。
- `GET /api/access/mode/wiki` 与 `shared_file` 均返回 `state=shadow`、`enforced=false`、`useUnifiedEditor=true`；非法 module 返回 `400`。此前 `/api/rbac/migration/resources/{module}/mode` 的 500 是错误路径，正确端点为 `/api/access/mode/{module}`。
- 浏览器运行时当前无可连接实例，因此 `AUTHZ-001`（首页点击工作台）和 `AUTHZ-003`（工作台 UI 展开）保留 UI 待复验；不得用本次 API 结果替换其 UI 合同。本次接口层 `AUTHZ-016` 通过。未执行 Enforce、Rollback、break-glass 或任何业务写入。
- 证据：`test-results/FQA_20260717_1245_final_l4/AUTHZ-001-003-016-rem-p0-004-api-reverification/result.json`。

## Phase 2：REM-P0-004 后授权工作台 UI 复验

- Playwright 真实以 superadmin 从 `/login` 登录，使用侧栏“迁移异常”入口进入 `/rbac/migration-exceptions`；未以直接 URL 代替入口路径。
- 工作台显示“Shadow 准备中”和“严格切换门禁：通过”；待处理账户、门禁问题、最新判定差异、未观测授权及迁移异常均为 `0`，与本轮 API 严格预检一致。
- “全量切换 Enforced”控件仅可见性观察，未点击；没有执行回填、Enforce、Rollback、break-glass 或任何业务写入，浏览器 console error 为 `0`。
- 因此 `AUTHZ-001` 与 `AUTHZ-003` 在 `039502b4` Shadow 基线上重新结算 PASS；`AUTHZ-016` 已由同轮 API 复验 PASS。证据：`test-results/FQA_20260717_1245_final_l4/AUTHZ-001-003-rem-p0-004-ui-reverification/result.json`。

## Phase 3：REM-P0-004 后 Wiki 只读 UI 复验

- Playwright 以真实 superadmin 会话从侧栏“知识库”进入空间列表，再使用可见的“Bug 反馈与建议”空间卡片进入空间；列表、空间目录和 4 个既有已发布页面均正常显示。
- 从空间目录进入“知识图谱”，页面在 `/wiki/7/graph` 正常渲染 4 个节点、3 条引用和 4 个既有页面节点；无内容、ACL、导出或回滚写入。
- 三条 `chrome-extension://` 注入脚本 messaging timeout 仅属于浏览器扩展运行噪声，不属于平台资源或页面 console error；本轮未出现平台脚本错误。
- 本轮在新基线结算 `WIKI-001`、`WIKI-014` PASS。搜索、版本和导出合同未在本段执行，不扩大计数。证据：`test-results/FQA_20260717_1245_final_l4/WIKI-001-014-rem-p0-004-ui-reverification/result.json`。


## Wiki 页面节点自动化异常（未登记产品缺陷）

- 初次 L4 自动化中，节点点击被浏览器控制层错误映射到“新建子页面”操作；两次对话框均立即取消，未产生写入。
- 只读源码核对显示 `WikiTreeSidebar.TreeNode` 的主点击明确路由到 `/wiki/{spaceId}/{pageId}`，子页创建仅由独立加号控件触发；因此该现象当前不足以作为产品 FAIL 或新 REM。
- 已撤销临时 L4 缺陷记录和预建事件；后续以稳定的 Playwright 定位器重新复验 `WIKI-016/017`，在有可复现产品行为前不改变功能结论。

## Phase 4：Nginx 入口与 Wiki 版本/导出复验

- `.env` 中的 `FQA_SUPERADMIN_PASSWORD` 经后端 `POST /api/auth/login` 真实验证为有效；此前失败源于误将前端容器直连端口 `3001` 作为浏览器入口，该端口不代理 `/api`，返回的 404 被登录页统一文案误显示为凭据错误。本轮统一以 Nginx 开发入口 `http://127.0.0.1` 执行。
- 当前空间 `#7` 的实时树为页面 `#50` 至 `#53`；历史证据中已失效的 `#86` 仅是测试数据漂移，未作为产品失败。真实会话下 `#50` 正确显示内容、`v1`、导出、版本历史与空间导出入口，且 console/page error 均为 0；未执行回滚或任何业务写入。
- 当前 Chrome 自动化会话对这些 React button 的事件注入未触发路由/折叠切换（Playwright 与坐标点击一致）；源码与已有同 run 完整下载/版本 API/UI 证据可证明产品合同，故记录为自动化表面限制，不新建产品缺陷、不改变 `WIKI-016/017` PASS。证据：`test-results/FQA_20260717_1245_final_l4/WIKI-016-017-nginx-ui-reverification/result.json`。

## Phase 5：REM-P0-005 platform superadmin 资源 ACL 复验

- L4 发现有效 `platform` 范围 `super_admin` 会在统一授权 Shadow 裁决中被 Wiki 与共享文件 ACL 拒绝；用户确认仅该有效 assignment 且具备对应功能权限的主体可绕过资源 ACL，不扩大 tenant/group/document admin、普通 platform scope 或 break-glass。
- 事件分支基于 `039502b4` 完成 L1 定向授权测试与后端编译；Shadow 后端健康为 `UP`。真实 superadmin 会话读取 `/api/wiki/pages/50` 与 `/api/files` 均为 `200`，严格预检保持 `eligible=true`、`latestDecisionDiffs=0`、`unobservedPermissionGrants=0`。
- Playwright 通过正式 Nginx 入口 `http://127.0.0.1` 从真实登录会话访问 `/wiki/7/50`，既有页面正确呈现且平台 console error 为 `0`。未执行 Enforce、Rollback、break-glass、批量 ACL/角色/assignment 变更或 Redis/会话清空。
- 此为事件级 L1-L3 复验，不替代最终 `275+78` 全矩阵；本 run 的总计数与完成门槛保持不变。证据：`test-results/FQA_20260717_1245_final_l4/REM-P0-005-platform-superadmin-resource-acl-bypass/result.json`。
