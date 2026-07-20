# REM-P1-063 实施合同

## 目标

AI Provider 测试连接成功返回 200/回复；预期 Provider 失败返回稳定 400/`AI_PROVIDER_TEST_FAILED`，页面显示明确失败，无未处理 500 或秘密泄露。

## 范围

- `AiConfigController.testProvider` 将 service RuntimeException 转换为统一 BusinessException。
- service 调用日志与 Changedoc AI 生成异常语义保持不变。
- 单测与真实 UI/API 覆盖成功、失败、日志、密钥和恢复。

## 非目标

不改变 AI 业务生成、Provider HTTP 客户端、重试、超时、配置输入边界、数据库或全租户配置。

## 验收

| ID | 合同 |
|---|---|
| AC-001 | 隔离 mock 成功返回 200 和回复，UI 显示成功。 |
| AC-002 | 上游 4xx/调用失败返回 400/`AI_PROVIDER_TEST_FAILED`，UI 显示失败。 |
| AC-003 | 响应、页面、证据和日志不包含 API key；无 `Unhandled exception`。 |
| AC-004 | Provider 配置精确恢复，manifest 0/0。 |

## GitNexus 影响

- Controller `testProvider`：LOW，无上游或流程。
- Service `testProvider`：LOW，1 个 Controller 调用者。
- `callWithLogging` 为 LOW 但影响 Changedoc AI 生成流程；本事件不修改它。

## 回滚

回滚事件提交恢复测试入口旧错误映射；无迁移或历史数据改写。
