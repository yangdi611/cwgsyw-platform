# REM-P1-008 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | CMDB-005 | L1 | Java 21 容器：`CiAttributeServiceContractTest,CmdbMetadataRequestValidationTest` | `PASS` |
| `AC-002` | CMDB-006 / CMDB-008 / CMDB-009 / CMDB-010 / CMDB-011 / CMDB-017 | L2 | DTO 边界、defaultValue create/update/readback、重复与并发唯一冲突契约 | `PASS` |
| `AC-003` | 边界 / deny / 并发 / 零副作用 | L2 | 真实会话 API：400/403、重复和并发、详情回读、逆序清理 | `PASS` |
| `AC-004` | 受影响模块 | L3 | 后端 Java 21 镜像构建、前端生产构建、健康检查、CMDB 2D/VO 回归、真实 UI 点击 | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | GitNexus detect 为 MEDIUM（Mapper 影响 export），定向回归与产品 API 清理通过 | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

原始证据：`defects.md` 的 `BUG-FQA-047`、`BUG-FQA-079`、`BUG-FQA-090`、`BUG-FQA-091` 和对应 test-results。PASS 要求行为、持久化、权限、审计、清理全部一致；FAIL 包括残留、未解释 5xx/Console error；BLOCKED 必须注明解除条件。禁止覆盖历史证据。

## 2026-07-15 当前复验记录

- GitNexus 在当前基线刷新后，`CiModelController.update`、`CiAttributeController.update`、`CiAttributeService.create/update`、`AddAttributeDialog` 与 `EditAttributeDialog` 均为 `LOW`；服务和 UI 各一个直接消费者，无受影响执行流。
- L1：Java 21 容器中定向执行 `CiAttributeServiceContractTest,CmdbMetadataRequestValidationTest` 通过（4 tests）。
- L3 静态构建：当前事件分支的后端 Docker 构建通过；后端容器替换后 `GET /actuator/health` 返回 `UP`；前端 Docker 生产构建通过。
- 未执行真实 API/UI：运行时未设置 `FQA_SUPERADMIN_PASSWORD`，浏览器无可用登录会话；按执行合同，不读取历史密码、不伪造登录或测试证据。未创建测试对象，因此无 cleanup 项。

## 2026-07-15 运行时 API 复验

- 使用临时运行时凭据取得真实管理员会话；凭据、token 和 cookie 均未写入仓库或证据。
- 创建唯一 runId 模型、属性分组和属性后，非法模型颜色返回 `400`，合法颜色保存成功；64 字符 fieldKey 成功，65 字符 fieldKey 返回 `400`；重复创建返回 `400`；两个并发创建请求恰有一个成功、一个拒绝。
- 属性默认值创建、更新、属性列表刷新和模型详情回读均返回更新后的默认值与排序。首次刷新暴露 `CiAttributeMapper.listByModel` 未映射 `default_val`；已补显式 `default_val -> defaultValue` 映射，重建容器后复验通过。
- 未认证属性读取返回 `403`。测试属性、属性分组和模型已通过产品 API 逆序删除；随后模型读取返回不存在错误，runId active 对象为 0。
- UI 点击复验仍未执行：浏览器控制端报告无可用浏览器实例。该限制不改写为 PASS，`AC-004` 和事件状态保持 `PARTIAL_PASS` / `VERIFYING`。

## 2026-07-16 UI 复验

- 以当前事件分支构建的 frontend/backend 容器为目标，通过开发 Nginx 入口完成真实浏览器登录和 CMDB 管理页点击路径。
- 新建属性对话框输入 fieldKey、名称、defaultValue 与 sortOrder 后创建成功；属性卡的图标按钮补充了可访问名称，随后可通过真实编辑动作更新 defaultValue/sortOrder。
- 页面刷新后重新打开编辑对话框，defaultValue 回填为 `updated`、sortOrder 回填为 `5`，证明 UI 读取、提交、失效刷新和回读一致。
- 使用唯一 runId 创建模型、属性分组和属性；复验结束后均通过产品 API 逆序删除，未留下活跃测试对象。

## 2026-07-20 L4 缺口复验

- 首次失败：L4 `CMDB-011` 重复 option ID 返回 200 并持久化；证据 `test/l4-cmdb-fieldtype-contract-current-run.spec.js`、`/tmp/fqa-2050-cmdb-types-r3`、提交 `229204d0`。失败夹具已产品 API 清理，manifest 为空。
- L1：Java 21 `CiAttributeServiceContractTest` 8/8 PASS，覆盖新/旧 option 输入、重复 ID、enum/enummulti 已用项删除和无 option 兼容更新。
- L2：`CiAttributeServiceContractTest,CmdbMetadataRequestValidationTest,CiFieldSchemaValidatorTableTest,Ci2DViewServiceTest,CmdbVoSerializationTest` 全部 PASS。
- L3：当前分支 backend 镜像构建并替换容器，健康 `UP`。真实 API 得到重复创建 400、删除已用项 409、兼容更新 200 和原 option 不变；测试对象全部产品 API 逆序清理，模型读回 400。
- 结论：事件恢复为 `VERIFIED`；最终关闭仍依赖同一 L4 run 的 `CMDB-011` 受影响复验及完整 L4 收敛。
