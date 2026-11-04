# SOS 报告解析与 CMDB 入库

- Linear：YAN-109（P1 YAN-110，P2 YAN-111，P3 YAN-112）
- 分支：`feat/YAN-109-sos-report`，基于 `origin/development`
- 风险：High（工作流、CMDB 写入、迁移、上传不可信归档）

## 目标

在“资源与文档中心”上传 sosreport，解析为结构化事实，映射到 CMDB `host` 模型字段，
经人工确认和 Flowable 审批后写入 CMDB。字段可在运行时新增，因此映射以规则形式保存，
AI 只负责为新字段提出候选规则。

## 非目标

- 自动创建 CMDB 字段，或修改内置 `host` 模型。网卡和磁盘只存结构化 JSON。
- AI 读取原始文件或主机真实值；AI 直接写 CMDB；角色推断和异常分析。
- 部署、迁移生产数据、配置生产工作流绑定。

## 已确认的决策（项目负责人，2026-11-04）

| 决策 | 结论 |
|---|---|
| “工单”的含义 | Flowable 审批，通过 `BusinessWorkflowAdapter` 接入 |
| 网卡和磁盘 | 存 JSON，不改内置模型 |
| 没有序列号的主机 | 必须人工填写后才能提交 |
| AI 外发内容 | 只有字段定义和事实目录，不含主机的值 |
| AI 建议生效方式 | 全部人工确认，不设自动通过 |
| AI 关闭时 | 内置字段走预置规则，新字段走手动映射，流程照常可用 |

## 实现中追加的安全决定

**原始压缩包不长期保留。** 样本证明 sosreport 可能含明文凭据（Ansible 清单、kickstart）。
原包只在解析期间存放于 MinIO，解析进入终态（成功或最终失败）后立即删除，也不提供下载接口。
这样凭据不会进入对象存储的长期数据和备份。代价是解析器升级后需要重新上传才能重新解析。

## 流程

```text
上传 -> MinIO 暂存 -> sos_report(pending)
     -> 定时器认领（租约）-> 流式读取白名单文件 -> facts JSONB(parsed) -> 删除原包
     -> 预览：规则 + 事实 = 字段值，与现有 CI 比对
     -> 提交：sos_cmdb_request(pending_approval) + Flowable 流程
     -> 审批通过：写入 CI，记录 audit_log 和 ci_change_record
     -> 审批驳回：不写入
```

## 解析安全边界

- 不解压到磁盘，只流式读取 tar 条目，白名单文件读入内存。
- 路径穿越条目直接判定归档不安全；symlink、硬链接、FIFO、设备文件一律跳过，不跟随。
- 上限：上传 200 MB；解压总量 5 GiB；条目 50 万；单文件 16 MiB；读入内存合计 128 MiB；XZ 字典内存 256 MiB；耗时 5 分钟。
- 白名单见 `SosArchiveReader`。Ansible 清单、kickstart、日志、进程表都不在白名单内。
- 错误信息只记录错误码和固定文案，不回显归档内容。

## 调度

Spring 默认调度线程只有一个，解析不能阻塞其他定时任务。`SosReportParseWorker` 由定时器轮询，
在独立的单线程执行器中解析，同一实例同时只解析一份。多实例通过条件更新 + 租约认领，互不重复。

- 归档错误（格式、不安全、超限）：直接进入 `failed`。
- 临时错误（对象存储等）：最多重试 3 次，之后进入 `failed`。

## 映射规则

规则按“租户 + 模型 + 字段”保存，来源是预置、手动或 AI 建议。

- **预置规则**：`sn`、`inner_ip` 等内置字段写在代码里，不经过 AI。
- **确认规则**：`sos_field_mapping.status = confirmed`。
- **失效**：保存规则时记录字段指纹（类型 + 枚举选项）。指纹变化后规则不再生效，需要重新确认。
- **转换方式**：只能从固定集合选择（`SosTransform`），不接受自由表达式。
- **AI 边界**：内置字段、`table`、`enummulti`、`objuser` 不发给 AI。

## CI 匹配

依次用 `sn`、系统 UUID（通过历史入库记录）、`inner_ip` 匹配现有 `host` 实例。

| 情况 | 结果 |
|---|---|
| 没有匹配 | 新增 |
| 所有匹配指向同一实例，且 `sn` 没有冲突 | 更新 |
| 匹配到多个实例 | 冲突，禁止提交 |
| 只有 IP 匹配，且两边序列号不同 | 冲突，禁止提交（可能是 IP 复用或换机） |

更新时不改 `is_editable = false` 的字段（如 `sn`、`inner_ip`）。值不同时在预览中提示。

## 审批回调

`onWorkflowCompleted` 在审批事务内同步运行。CI 写入放在 `PROPAGATION_NESTED`（保存点）中：

- 写入成功：请求变为 `applied`。
- 写入失败（如审批期间出现重复 `sn`）：回滚到保存点，请求变为 `apply_failed` 并记录原因，审批本身不回滚。
- 回调重复执行：请求已不是 `pending_approval`，直接跳过。
- 同一序列号的并发审批：通过 `pg_advisory_xact_lock` 串行化。CMDB 手工创建不走这把锁，
  CMDB 唯一性仍只在应用层检查，这是既有限制。

## 审批入口

系统目前没有通用的待办中心：`WorkflowRuntimeFacade` 的 `listMyTasks` 和 `completeTask` 没有调用方，
也没有接口和页面。Wiki 和变更文档一旦绑定流程，也会遇到同样的问题，这是既有缺口。

本任务只在 SOS 模块内补最小入口（SOS 报告页的“待我审批”），候选关系和业务权限仍由 Facade 和适配器判定。
通用待办中心不在本任务范围内，需要单独立项。

## 审批通知

提交后和每级审批后，通知当前任务的全部候选审批人（站内通知 + 邮件）。

- **收件人**：逐个判定租户内的启用用户，规则与审批时相同（`isTaskCandidate` + `canApprove`），收到通知的人一定能审批。
- **时机**：事务提交后在独立线程发送。发送失败只记日志，不影响提交和审批；进程重启时未发出的通知会丢失。
- **去重**：按“任务 + 用户”去重，两级审批的第二级是新任务，会再通知一次。
- **内容**：实例名、新增或更新、提交人、字段数，不含字段值，因为邮件会发到系统外。
- **链接**：站内通知整条可点击；邮件写完整网址，需要配置 `APP_PUBLIC_URL`，未配置时只提示到系统内查看。
- 其他候选人处理后不撤回通知，点进去会看到该申请已处理。

## AI 留痕

只要有字段的取值规则来自 AI 建议，审批内容就必须写明。

- 提交时把字段来源存入 `sos_cmdb_request.field_details` 快照，规则之后变化不影响已提交的申请。
- 审批弹窗逐字段标出“AI 建议的规则”，并显示置信度和理由；通知和邮件写明涉及哪些字段；审计日志记录 `aiFields` 数量。
- AI 只判断“事实对应哪个字段”，字段的值仍由解析器取得，审批内容按这个口径说明。
- 管理员修改 AI 建议后再确认，规则来源记为人工；入库时手动填写的字段记为人工填写。

## 权限

新增资源 `sos_report`：

| 动作 | super_admin / admin | group_leader | member |
|---|---|---|---|
| `read` | 有 | 有 | 有 |
| `upload` | 有 | 有 | 有 |
| `submit` | 有 | 有 | 无 |
| `delete` | 有 | 无 | 无 |
| `approve` | 有 | 无 | 无 |
| `manage_mapping` | 有 | 无 | 无 |

审批还要求审批人有 `cmdb_instance:create`（新增）或 `cmdb_instance:update`（更新）。
数据范围是租户级，与 CMDB 实例一致，不做组级隔离。

## 接口

全部位于 `/api/sos-reports`，字段使用 camelCase。

| 方法与路径 | 权限 | 说明 |
|---|---|---|
| `POST /upload` | `upload` | multipart 字段 `file` |
| `GET /` | `read` | 分页，参数 `keyword`、`status`、`page`、`size` |
| `GET /{id}` | `read` | 详情和事实 |
| `DELETE /{id}` | `delete` | 软删除，审批中不可删 |
| `POST /{id}/cmdb-preview` | `read` | 映射结果和比对，请求体可带人工修改，不写入数据 |
| `POST /{id}/cmdb-requests` | `submit` | 提交审批 |
| `GET /{id}/cmdb-requests` | `read` | 申请历史 |
| `GET /approvals` | `approve` | 当前用户可审批的入库申请 |
| `POST /cmdb-requests/{requestId}/decision` | `approve` | 通过或驳回，驳回时必须填写原因 |
| `GET /fact-catalog` | `read` | 事实目录 |
| `GET /mappings` | `read` | 字段规则列表 |
| `PUT /mappings/{fieldKey}` | `manage_mapping` | 确认规则或标记无法映射 |
| `DELETE /mappings/{fieldKey}` | `manage_mapping` | 移除规则 |
| `POST /mappings/suggestions` | `manage_mapping` | AI 生成建议 |

## 运维事项

1. 发布后需要管理员在工作流模板和绑定页面为 `sos_cmdb_request` 配置流程。未配置时页面提示，不写 CMDB。
2. AI 建议需要在 AI 配置页启用提供商。未启用时只影响“生成建议”。
3. nginx 为 `/api/sos-reports/upload` 单独设置 `client_max_body_size 200m`。
4. 配置 `APP_PUBLIC_URL` 和 SMTP，审批通知邮件才带完整链接。

## 发布前验证

开发环境没有 Docker，也不能运行 PostgreSQL、Redis 和 MinIO，下面这些步骤**还没有执行过**，发布前必须跑一遍。

后端集成测试（需要 Docker）：

```bash
cd backend && mvn test -Dtest='UnifiedTaskFreshInstallMigrationTest,UnifiedTaskIncrementalMigrationTest'
```

端到端验收：

1. 启动开发环境，确认 `V112` 迁移成功，应用能正常启动（没有 bean 循环依赖）。
2. 在工作流模板页为“SOS 报告入库”创建单人审批模板并发布，再到绑定页启用绑定。
3. 上传真实 sosreport，确认状态从排队中变为解析成功，字段与实际主机一致。
4. 确认对象存储中 `sos-reports/` 下的原始压缩包已被删除，`sos_report.object_key` 为空。
5. 在 CMDB 入库页提交审批，在 SOS 报告页“待我审批”通过，确认 `host` 实例已创建，
   且 `audit_log`、`ci_change_record` 都有记录。
6. 用同一台主机的另一份报告验证“更新”，确认只改差异字段，不改 `sn`、`inner_ip`。
7. 审批前在 CMDB 手工创建相同 `sn` 的实例再通过，确认审批不报错、申请显示写入失败。
8. 驳回一条申请，确认 CMDB 没有变化。
9. 在 CMDB 新增一个自定义字段，确认映射规则页显示为待配置；启用 AI 后生成建议，确认需要人工确认才生效。
10. 确认候选审批人收到站内通知和邮件，点击能打开报告；确认 AI 建议的字段在审批弹窗和通知里都有标注。
11. 用 `member` 角色确认看不到删除、审批和映射配置入口，并直接调用接口得到 403。

用其他报告核对解析结果（报告不进入仓库）：

```bash
SOS_REPORT_SAMPLE=/path/report.tar.xz SOS_REPORT_OUTPUT=/tmp/facts.json \
  mvn test -Dtest=SosReportParserTest#parsesRealSample
```

## 回滚

1. 回滚应用版本：新表和新权限不被旧版本使用，无副作用。
2. 迁移 `V112` 只新增对象，不改现有表，不需要回滚脚本。确需清理时，先确认无数据依赖，
   再删除 `sos_cmdb_request`、`sos_field_mapping`、`sos_report` 和 `sos_report:*` 权限。这是单独授权的操作。
3. 已审批写入的 CI 是正常 CMDB 数据，不随回滚删除；可通过 `ci_change_record` 和 `sos_cmdb_request` 追溯。

## 已知风险

- 没有禁止提交人审批自己的申请，与 Wiki 审批行为一致；审批人由流程绑定决定。
- 解析器只用一份 UOS 20 物理机样本验证过，虚拟机、ARM 和其他 sos 版本需要更多样本。
- CMDB 字段没有描述列，AI 只能依据字段名和类型判断，所以新规则必须人工确认。
- 字段名和枚举选项会随 AI 请求外发，其中可能出现业务名称。
- `disk_gb` 的口径是“操作系统可见的物理盘容量合计”，RAID 卡后的物理盘不可见。
