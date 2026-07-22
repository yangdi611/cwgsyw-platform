# 实施记录

## 2026-07-20：认领、影响与根因

- 从 `lint-fix@a5482a775` 创建 `codex/rem-p1-060-change-doc-submit-idempotency`。
- 原始 L4 并发 submit 为 `200/200`；终端审批/导出链随后暴露 approve 同样缺少幂等锁，以及归档 SharedFile 元数据与 MinIO 对象不一致导致清理 503。
- GitNexus：submit LOW/1 direct caller；approve LOW/1 direct caller；共享 `copyOrThrow` HIGH/15 impacted symbols、3 modules，因此没有修改其公共行为。

## 2026-07-20：实现

- `ChangeDocMapper.selectForUpdate` 增加 tenant、active-row、`FOR UPDATE` 查询。
- `ChangeDocService.submit`、`approve` 在访问校验后锁定同一文档并复核状态；第二个并发请求返回既有状态冲突。
- `MinioStorageService.copyIfPresent` 仅将明确 `NoSuchKey` 转为 false；其他存储错误仍返回 `STORAGE_DELETE_FAILED`。
- `SharedFileService.deleteFileUnchecked` 只对存在对象执行备份/删除，对缺失对象继续删除精确元数据并写既有审计。
- `SharedFileServiceTest` 增加正常删除、普通存储故障保护和缺失对象孤儿记录清理覆盖；新增 Mapper SQL 锁合同测试。
- Playwright 夹具保留合法 runId 大小写，覆盖 rejected 终态的产品清理回退路径，并使用实际导出可见字段进行内容断言。

## 2026-07-20：验证与清理

- Java 21 L1 12/12，受影响 L2 52/52，生产编译和当前 backend 容器健康。
- `/tmp/rem-p1-060-l3-final3` 真实运行 1/1 PASS；submit、approve 并发分别为 `200/409`，唯一审计/快照、归档、重草稿、拒绝、导出权限均通过。
- 先前失败运行产生的文件 170-173、文档 268/269/273 和模板 42/43/52/53 均通过产品 API 清理；最终 manifest `objects=[]`、`cleanupFailures=0`。未使用 SQL、restore、MinIO 删除命令、Redis 或卷清空。
- 当前工作区保留用户既有的 `test-results` 删除及四个测试文件改动，事件提交不得暂存这些路径。

## 待完成门禁

- 全局 INDEX、README、FQA 矩阵、检查点和本事件 run 证据索引已回写；staged GitNexus `detect_changes` 为 13 个预期符号、0 个受影响流程、LOW。
- 事件提交已创建：`6ff31208`；待 no-ff 合并到 `lint-fix`。
- 合并后从同一 `FQA_20260718_2050_remp1038` 恢复，重跑 `CHANGE-019`、`ST-CHANGE-001/004`、`CHANGE-013` 受影响链并继续剩余 L4。
