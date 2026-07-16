# REM-P2-006 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`。
- 规划基线：`lint-fix@842dc84f`。
- 来源缺陷：`BUG-FQA-022`；用例：`SYSTEM-CONFIG-READ-BOUNDARY`。
- 根因聚类：Controller 使用了只设置业务码的响应重载，没有映射明确的客户端错误状态。
- GitNexus：索引已刷新至当前规划基线并完成领域 query；尚未编辑业务符号，因此未伪造逐符号 impact 结果。
- 代码、数据、容器：未修改、未启动、未创建测试对象。
- 下一步：认领独立分支后读取本事件全部文档，对候选符号逐项执行 upstream impact，再从 `AC-001` 开始。

## 追加规则

后续只追加状态变化、实际文件/符号、impact、提交/diff、测试命令、证据、清理、回滚和剩余风险；不得覆盖历史记录。

## 2026-07-16：认领、实现、授权排查与拒绝路径复验

- 状态：`BLOCKED`；分支：`codex/rem-p2-006-configuration-http-status-contract`；基线：`lint-fix@d8d2c22`。
- GitNexus：`SysConfigController.updateGeneric` 与 Controller 类 upstream 均为 LOW、零直接调用者/流程。下游分析因共享 `R.ok` 显示 CRITICAL，因此未修改共享 `R` 或 SysConfigService；只修改 Controller 自身拒绝路径。
- 实现：空对象、非白名单 key、非字符串绑定值在写入前抛出 IllegalArgumentException；既有全局处理器返回 HTTP/body 400。允许字符串与 null 清空语义保持原样。新增 `SysConfigControllerTest`，断言三类拒绝不调用 `configService.set`，允许字符串仍调用既有服务。
- 验证：生产编译、当前分支 backend 容器构建及 health 通过。定向 Maven 测试被三个无关历史 testCompile 错误阻断。真实认证会话下 unsupported、empty、non-string 都返回 HTTP/body 400，配置读取前后快照完全一致；三条 Console 网络错误均对应预期 400 拒绝。
- 授权排查与恢复：经用户明确授权，在本地开发数据库临时建立最小 runId 角色/分配；登录响应确认 superadmin 原本已有 workflow:configure，根因是浏览器脚本先前未使用 `cwgsyw_token`。验证后删除临时 legacy 关联和角色权限，软删除临时作用域分配与角色；四项有效计数均为 0。
- 未解除项：允许白名单 key 的真实成功路径会写全局配置并保留不可精确清理的审计记录。当前授权没有覆盖该持久副作用，因此不以静态测试或拒绝路径替代；等待用户批准快照→写入→恢复（审计保留），或提供隔离可清理环境。
- 回滚：移除本分支 `SysConfigController` 校验和对应定向测试即可；事件未提交、未合并。

## 2026-07-16：授权成功路径、upsert 修复与受影响路径回归

- 状态：`VERIFIED`。用户批准本地开发环境一次性读取配置快照、写入允许 key、恢复原值并保留审计记录。
- 影响：复做 GitNexus upstream 后，`SysConfigService.set` 为 HIGH：5 个直接调用者、4 个模块、1 条工作流模板创建流程；用户明确授权共享修复及回归。`updateGeneric` 保持 LOW、零直接调用者。未修改共享 `R`。
- 根因与实现：`set` 原先只执行带 `(tenant_id, config_key)` 条件的 UPDATE，缺失 key 时返回成功但写入零行。`SysConfigMapper.upsertValue` 改为 PostgreSQL `INSERT ... ON CONFLICT (tenant_id, config_key) DO UPDATE`，同时维护 `updated_at`，从而使首次写入和既有值更新具有同一原子语义。
- 回归：新增 `SysConfigServiceTest` 断言服务调用原子 upsert；扩展 `SysConfigControllerTest` 覆盖通用流程绑定、SMTP、通知、水印入口均进入共享写入服务。定向 Maven 仍被三个无关的历史 testCompile 错误阻断；生产 compile、当前分支 backend 容器构建与健康检查通过。
- 运行时：允许 key 初始不存在，写入后可读回，`null` 恢复后读回空字符串。两条授权保留的 `sys_config/update` 审计只含键名、JSON 快照为空，不含配置值。临时权限诊断对象已全部恢复为零。
- 回滚：回退本事件提交即可恢复旧行为；不需要 schema 回滚。本次验证已将允许 key 恢复为空值；审计记录按用户授权保留。
