# REM-P1-008 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-047`、`BUG-FQA-079`、`BUG-FQA-090`、`BUG-FQA-091`；用例：`CMDB-005`、`CMDB-006`、`CMDB-008`、`CMDB-009`、`CMDB-010`、`CMDB-011`、`CMDB-017`。
- 根因：Controller @Valid、DTO/schema 边界、唯一索引和 entity/VO 映射没有形成闭环。
- GitNexus 已刷新并完成领域 query；未编辑业务符号，逐符号 impact 留给实施门禁。
- 未修改代码、数据库或容器，未创建测试对象。
- 下一步：独立分支认领后，从 `AC-001` 开始并追加实际 impact、diff、测试、证据、清理和回滚。

后续记录只追加，不覆盖历史。

## 2026-07-15：实现、L1 与部分 L3

- 分支：`codex/rem-p1-008-cmdb-model-attribute-contracts`；集成基线：`lint-fix@b149e835`；状态：`VERIFYING`。
- GitNexus：刷新索引；`CiModelController.update`、`CiAttributeController.update`、`CiAttributeService.create/update`、`AddAttributeDialog`、`EditAttributeDialog` upstream impact 均为 `LOW`。两个 service 符号各有一个直接服务入口，两个 UI 组件各有一个直接使用方；未命中受影响执行流。
- 实现：模型和属性更新 Controller 补 `@Valid`；属性 DTO 收敛 fieldKey/name/groupId/fieldType/sortOrder 边界；管理端新增/编辑对话框支持 defaultValue、sortOrder，并对 fieldKey 同步 64 字符输入限制与提示；前端管理项同步读取 defaultValue。
- 测试：新增 `CiAttributeServiceContractTest` 与 `CmdbMetadataRequestValidationTest`，覆盖 defaultValue create/update/readback、并发唯一冲突映射、非法颜色、65 位 fieldKey 和负排序。Java 21 容器定向 Maven 测试通过（4 tests）。
- 构建：当前分支后端 Docker 镜像构建通过并替换 backend 容器；健康检查 `UP`。前端 Docker 生产构建通过。GitNexus `detect-changes`：7 个源码文件、16 个符号、0 个受影响流程、`LOW`。
- 运行时门禁：未设置 `FQA_SUPERADMIN_PASSWORD`，无浏览器可复用登录会话；没有创建 runId 测试对象，也无清理残留。恢复后以环境变量临时提供密码，执行模型颜色 400、fieldKey 64/65、重复/并发 409、defaultValue create/update/refresh、deny 和产品 API 逆序清理。

## 2026-07-15：运行时 API 复验与 mapper 根因补齐

- 运行时 API 通过真实管理员会话执行，未持久化任何凭据。创建的模型、分组和属性均带唯一 runId；清理按属性、分组、模型逆序调用产品 API，随后读取模型返回不存在错误。
- API 证据：非法颜色 `400`、合法颜色成功；fieldKey 64 字符成功、65 字符 `400`；重复 `400`；并发一成功一拒绝；未认证属性读取 `403`；defaultValue 与 sortOrder 在属性列表和模型详情刷新后稳定回读。
- 运行时首次发现 defaultValue 在属性更新响应正常但列表刷新为空。已对 `CiAttributeMapper.listByModel` 追加 `default_val -> defaultValue` 显式结果映射，并保留 JSON option 映射。
- 该 Mapper 方法的 GitNexus upstream impact 为 `HIGH`：14 个直接调用者、41 个受影响符号、一个 `Export → ListByModel` 流程、4 个模块。已先告警后实施，且定向执行 `CiAttributeServiceContractTest`、`CmdbMetadataRequestValidationTest`、`Ci2DViewServiceTest`、`CmdbVoSerializationTest` 通过；后端 Docker 构建和真实容器复验通过。
- UI 浏览器控制端无可用实例，无法按产品真实点击路径验证新增/编辑对话框；此项未伪造 PASS，事件继续保持 `VERIFYING`，不得提交或合并。

## 2026-07-16：UI L3 通过

- 本地 `.env` 已提供仅运行时使用的管理员密码变量；没有将密码、token、cookie、请求头或测试截图写入仓库。
- 使用临时 Playwright 容器经开发 Nginx 入口完成真实登录、模型管理页导航、新建属性、编辑属性、刷新与重新打开编辑对话框。刷新后 defaultValue 为 `updated`、sortOrder 为 `5`。
- 复验中发现属性列表的图标编辑/删除按钮没有可访问名称，既影响真实辅助技术使用，也无法稳定定位实际操作入口。对 `AttributeList` 的 upstream impact 为 `LOW`（一个直接 UI 使用方）；补充 `aria-label` 和 `title`，未改变权限、API 或业务行为。
- 最后一次 UI runId 的模型、属性分组和属性已通过产品 API 逆序清理。L1、L2、L3 全部 PASS，事件状态更新为 `VERIFIED`；等待最终 L4。

## 2026-07-20：L4 enum option 缺口修复

- 同一 L4 run `FQA_20260718_2050_remp1038` 发现 `CMDB-011` 失败：重复 enum option ID 的创建请求返回 200 并持久化。失败证据固定在 L4 提交 `229204d0`，所有属性、属性组、模型和模型组已通过产品 API 清理。
- 独立分支 `codex/rem-p1-008-enum-option-contracts` 从 `lint-fix@78d07cf16` 创建。GitNexus 对 `CiAttributeService.create/update` upstream impact 为 `LOW`，分别 3/2 个直接依赖、0 个执行流。曾评估新增 `CiInstanceMapper` 方法，impact 为 `CRITICAL`（31 个直接依赖、44 个总影响符号），因此放弃该方案，复用现有 `selectList`，未修改共享 Mapper。
- `CiAttributeService` 统一解析新 `option` 和旧 `enumOptions`，拒绝空/重复 option ID；更新显式选项时检查同租户同模型活动实例，拒绝删除被 `enum` 或 `enummulti` 使用的 ID。未提交 option 的名称/defaultValue 等兼容更新保持原选项不变。
- Java 21 L1-L2：`CiAttributeServiceContractTest,CmdbMetadataRequestValidationTest,CiFieldSchemaValidatorTableTest,Ci2DViewServiceTest,CmdbVoSerializationTest` 全部通过。当前分支 backend Docker 构建成功，仅重建 backend 容器，健康状态 `UP`。
- 真实 API：重复创建返回 400；合法 enum 与实例创建成功；删除已用项返回 409；仅改名称返回 200 且两项 option 原样回读。实例、属性、属性组、模型和模型组通过产品 API 逆序删除，模型读回 400；未修改数据库、Redis、MinIO、授权模式或非测试数据。
