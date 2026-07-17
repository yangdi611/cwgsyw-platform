# 证据索引

| ID | 结论 | 证据 |
|---|---|---|
| L4-PHASE0-001 | PASS | `environment-baseline.md`；backend health `UP` |
| AUTH-001 | PASS | `test-results/FQA_20260717_1245_final_l4/AUTH-001/result.json`；登录-首页-登出-受保护页回跳，零错误 |
| AUTH-003 | PASS | `test-results/FQA_20260717_1245_final_l4/AUTH-003/result.json`；四种拒绝输入均留在登录页 |
| HOME-003 / HOME-007 | PASS | `test-results/FQA_20260717_1245_final_l4/HOME-003-007/result.json`；35 个侧栏入口和三档响应式均通过 |
| HOME-004 | PASS | `test-results/FQA_20260717_1245_final_l4/HOME-004-006/palette-result.json`；命令面板空态、Escape、结果均通过 |
| HOME-006 | PASS | `test-results/FQA_20260717_1245_final_l4/HOME-004-006/history-result.json`；后退、前进和刷新保持路由 |
| HOME-005 | PASS | `test-results/FQA_20260717_1245_final_l4/HOME-005/result.json`；页头铃铛、未读数与通知列表均 200 |
| HOME-008 | PASS | `test-results/FQA_20260717_1245_final_l4/HOME-008/result.json`；浅/深色切换、刷新持久化以及图表/Markdown/BPMN 页面均可读且零错误 |
| HOME-002 | PASS | `test-results/FQA_20260717_1245_final_l4/HOME-002/result.json`；五个首页卡片/快捷入口均到达正确页面、标题与内容一致且零错误 |
| CMDB-035 | PASS | `test-results/FQA_20260717_1245_final_l4/CMDB-035-036/result.json`；关键字空结果、清除恢复、分页接口与变更历史筛选入口通过 |
| CMDB-036 | PASS | `test-results/FQA_20260717_1245_final_l4/CMDB-035-036/result.json`；默认趋势/Top 与明确未来空范围的卡片、趋势、Top 均同口径 |
| AUTHZ-003 | PASS | `test-results/FQA_20260717_1245_final_l4/AUTHZ-003/result.json`；严格 preflight、UI、cutover 及 blocker/count/detail 同口径，唯一 blocker 可定位 |
| AUTHZ-016 | PASS | `test-results/FQA_20260717_1245_final_l4/AUTHZ-016/result.json`；Wiki/共享文件 mode 与非法 module 400 合同通过 |
| REPORT-002 | PASS | `test-results/FQA_20260717_1245_final_l4/REPORT-002/result.json`；真实页面导出中文文件名的非空 XLSX，零错误 |
| NOTICE-002 | PASS | `test-results/FQA_20260717_1245_final_l4/NOTICE-002/result.json`；有效业务目标可达，失效/不可访问目标保持友好且不可枚举 |
| REPORT-001 | PASS | `test-results/FQA_20260717_1245_final_l4/REPORT-001/result.json`；正常/反向/未来空范围合同及 XLSX 响应均通过 |
| FILE-001 | PASS | `test-results/FQA_20260717_1245_final_l4/FILE-001/result.json`；文件夹树、文件列表、搜索空态与导航通过 |
| FILE-006 / FILE-007 | PASS | `test-results/FQA_20260717_1245_final_l4/FILE-006-007/result.json`；真实预览及下载的文件名/字节一致，零错误 |
| DEVICE-001 | PASS | `test-results/FQA_20260717_1245_final_l4/DEVICE-001/result.json`；设备列表、搜索空态和详情读取一致 |
| IPAM-001 | PASS | `test-results/FQA_20260717_1245_final_l4/IPAM-001/result.json`；地址池列表、搜索及无数据空态一致 |
| OPS-001 / OPS-002 | PASS | `test-results/FQA_20260717_1245_final_l4/OPS-001-002/result.json`；入口、范围和月/周/列表日期区间与任务集合一致 |
| CHANGE-001 | PASS | `test-results/FQA_20260717_1245_final_l4/CHANGE-001/result.json`；列表状态、筛选、搜索空态和详情对账通过 |
| WIKI-001 / WIKI-022 | PASS | `test-results/FQA_20260717_1245_final_l4/WIKI-001-022/result.json`；授权空间/页面读取、只读标识与不存在资源友好失败通过 |
| FLOW-003 / FLOW-004 | PASS | `test-results/FQA_20260717_1245_final_l4/FLOW-003-004/result.json`；我的/组待办、实例状态和活动历史读取一致 |
| AUDIT-001 | PASS | `test-results/FQA_20260717_1245_final_l4/AUDIT-001/result.json`；模块、动作、操作人、日期、关键字筛选与空结果分页通过 |
| 用户/用户组读取补充 | READ_ONLY_SUPPLEMENT | `test-results/FQA_20260717_1245_final_l4/RBAC-001-read/result.json`、`RBAC-READ-ONLY/groups-result.json`；不替代 RBAC 生命周期主用例 |
| CMDB-001 / CMDB-002 | PASS | `test-results/FQA_20260717_1245_final_l4/CMDB-001-002/result.json`；概览模型/模型组、实例浏览/详情/空结果和兼容入口重定向通过 |
| DAILY-001 | PASS | `test-results/FQA_20260717_1245_final_l4/DAILY-001/result.json`；月历范围、空分页、视图与状态图例在零数据环境正常 |
| CMDB-033 | PASS | `test-results/FQA_20260717_1245_final_l4/CMDB-033/result.json`；告警级别、状态筛选与零数据空结果同口径 |
| REPORT-003 | PASS | `test-results/FQA_20260717_1245_final_l4/REPORT-003/result.json`；Workflow 统计与实例源列表对账，CMDB 聚合复用 CMDB-036 证据 |
| 备份读取与恢复取消补充 | READ_ONLY_SUPPLEMENT | `test-results/FQA_20260717_1245_final_l4/BACKUP-READ-ONLY/result.json`；不替代创建/下载或受控恢复主用例 |
| ST-AUTHZ-019 | PASS | `test-results/FQA_20260717_1245_final_l4/ST-AUTHZ-019/result.json`；错误确认词 400，cutover/epoch/preflight 均不变 |
| AI 配置读取补充 | READ_ONLY_SUPPLEMENT | `test-results/FQA_20260717_1245_final_l4/AI-READ-ONLY/result.json`；无 API Key 返回且零写请求，不替代 AI 写入生命周期用例 |
| 系统配置读取补充 | READ_ONLY_SUPPLEMENT | `test-results/FQA_20260717_1245_final_l4/CONFIG-READ-ONLY/result.json`；SMTP 密码当前为空，配置页零写请求，不替代配置写入主用例 |
| CMDB-039 | PASS | `test-results/FQA_20260717_1245_final_l4/CMDB-039/result.json`；概览、实例列表、详情与面包屑返回链路通过 |
| CMDB-031 | PASS | `test-results/FQA_20260717_1245_final_l4/CMDB-031/result.json`；上游/下游/双向影响范围、层级与空图合同通过 |
| WIKI-017 | PASS | `test-results/FQA_20260717_1245_final_l4/WIKI-017/result.json`；页面 Markdown、空间 ZIP 与 UI 中文命名下载通过 |
| WIKI-014 | PASS | `test-results/FQA_20260717_1245_final_l4/WIKI-014/result.json`；图谱 29 节点/0 边、节点导航和页面渲染通过 |
| WIKI-013 | PASS | `test-results/FQA_20260717_1245_final_l4/WIKI-013/result.json`；搜索、URL、空态、结果导航和浏览器前进/后退通过 |
| CMDB-029 | PASS | `test-results/FQA_20260717_1245_final_l4/CMDB-029/result.json`；既有实例拓扑节点、边、根节点和页面渲染通过 |
| CMDB-030 | PASS | `test-results/FQA_20260717_1245_final_l4/CMDB-030/result.json`；历史时间点拓扑差异、关系差异及页面图例通过 |
| FLOW-001 | PASS | `test-results/FQA_20260717_1245_final_l4/FLOW-001/result.json`；统一待办我的/组范围与零任务空态通过 |
| FLOW-013 | PASS | `test-results/FQA_20260717_1245_final_l4/FLOW-013/result.json`；流程统计、计数不变量和页面渲染通过 |
| NOTICE-001 | PASS | `test-results/FQA_20260717_1245_final_l4/NOTICE-001/result.json`；通知分页、未读数与零业务写入通过 |
| WIKI-016 | PASS | `test-results/FQA_20260717_1245_final_l4/WIKI-016/result.json`；版本历史、导出与未触发回滚通过 |
| AUTHZ-001 | PASS | `test-results/FQA_20260717_1245_final_l4/AUTHZ-001/result.json`；Shadow 观测窗口的迁移工作台状态与 blocker 一致 |
| CMDB-018 | PASS | `test-results/FQA_20260717_1245_final_l4/CMDB-018/result.json`；实例详情六个只读标签正常加载 |
| CMDB-015 | PASS | `test-results/FQA_20260717_1245_final_l4/CMDB-015/result.json`；18 个模型实例列表均正常或精确空态 |
| OPS-018 | PASS | `test-results/FQA_20260717_1245_final_l4/OPS-018/result.json`；统计聚合、日期范围和未来空态通过 |
| OPS-019 | PASS | `test-results/FQA_20260717_1245_final_l4/OPS-019/result.json`；素材归集与非空中文 Excel 导出通过 |
| B1 动态/二级路由 | PASS | `test-results/FQA_20260717_1245_final_l4/B1-dynamic-routes/result.json`；29 条登录后路由均 200 且零错误 |
| AUTHZ 切换前快照 | PENDING_BYRON_CREDENTIAL | `test-results/FQA_20260717_1245_final_l4/AUTHZ-snapshot/before.json`、`workbench.json`；用户已授权切换，待既有 byron 账号登录输入以完成 5 条 Shadow coverage |
| AUTHZ-001 / AUTHZ-003 | PASS (UI reverified) | `test-results/FQA_20260717_1245_final_l4/AUTHZ-001-003-rem-p0-004-ui-reverification/result.json`；Playwright 从真实登录后的侧栏进入工作台，Shadow、严格门禁和全部差异计数均与 API 一致 |
| AUTHZ-016 | PASS (API reverified) | `test-results/FQA_20260717_1245_final_l4/AUTHZ-001-003-016-rem-p0-004-api-reverification/result.json`；当前 Shadow mode、统一编辑器启用及非法 module 400 |
| WIKI-001 / WIKI-014 | PASS (UI reverified) | `test-results/FQA_20260717_1245_final_l4/WIKI-001-014-rem-p0-004-ui-reverification/result.json`；从真实侧栏进入 Bug 反馈空间，空间目录和 4 节点/3 引用图谱正常渲染 |
| WIKI-016 / WIKI-017 | PASS (Nginx UI reverified) | `test-results/FQA_20260717_1245_final_l4/WIKI-016-017-nginx-ui-reverification/result.json`；凭据与后端确认一致，正式 Nginx 入口的当前页面 `#50` 正确呈现版本/导出入口，零页面错误；同 run 下载与版本 API 证据保持有效 |
| L4-AUTHZ-PLATFORM-ACL-001 / REM-P0-005 | VERIFIED (event-level L1-L3) | `test-results/FQA_20260717_1245_final_l4/REM-P0-005-platform-superadmin-resource-acl-bypass/result.json`；有效 platform super_admin 的 Wiki/共享文件 ACL bypass、功能权限 deny 回归、Shadow API/UI 与严格预检通过；不替代最终全矩阵 L4 |
