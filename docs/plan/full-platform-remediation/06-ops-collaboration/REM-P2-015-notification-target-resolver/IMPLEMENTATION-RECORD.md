# REM-P2-015 实施记录

## 2026-07-16：认领与合同确认

- 分支：`codex/rem-p2-015-notification-target-resolver`，基线：`lint-fix@8476bb7e26e4cb3b2b17f05cf7f28662d5da2fd8`。
- 用户明确批准新增“只读、权限感知的通知目标解析端点”。这与 REM-P2-011 原“无新增后端接口”非目标冲突；按用户最新指令建立独立增补事件，保留 P2-011 的历史证据不改写。
- GitNexus：`NotificationController` upstream LOW、0 direct callers；`NotificationService` upstream MEDIUM、9 direct callers，包含 Wiki、日报、变更、CMDB、运维与 scheduler producer。选择新增专用 resolver，禁止改投递路径。
- 已确认威胁模型：端点以当前用户 notification ID 为唯一输入，先校验归属；不可用状态中性化，避免 refType/refId 与目标存在性枚举；不写已读或业务对象。
- 下一步：逐符号 impact 后验证五种既有详情授权合同，实施不绕过 `@PreAuthorize`/ACL 的解析链。

## 2026-07-16：实施与 L1-L3 复验

- 补充 impact：目标页 LOW、0 direct callers；链接函数 LOW、1 direct UI caller；各既有目标服务 LOW（0–2 direct callers），均未修改。新增 `resolve` upstream LOW，唯一消费者为新增 endpoint。
- 实现：新增最小 DTO/resolver。通知归属、软删除或空引用先中性拒绝；已知类型经 Spring 代理的既有 Controller 详情读取验证访问后才生成相对 href。所有目标读取异常统一为 `available=false`，不返回原因。未改投递或 read lifecycle。
- UI：链接改为 notification-ID resolver 路由；新页面消费最小 response；关闭 Link prefetch，避免动态 resolver 路由在 router.replace 时产生无意义预取取消。
- 验证：backend compile、frontend lint（0 error、39 条既有 warning）、typecheck、build 通过；当前分支容器 API/UI 通过，有效/失效/随机/未认证、零副作用与零 endpoint failed request 均已核验。
- 清理：只消费既有只读通知和目标；未创建对象，`activeObjects=0`、`cleanupFailures=0`。回滚本事件提交即可移除 endpoint、DTO、resolver 和新前端路由。
