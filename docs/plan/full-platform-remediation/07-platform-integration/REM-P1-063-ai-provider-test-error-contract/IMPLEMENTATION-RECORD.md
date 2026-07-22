# 实施记录

## 2026-07-20：认领、影响与根因

- 从 `lint-fix@824115b8` 创建事件分支。
- 真实 UI 成功/失败 toast 均可见，但失败 API 为 500 且 GlobalExceptionHandler 记录未处理异常；provider 已恢复。
- `callWithLogging` 抛通用 RuntimeException；Controller 未把测试入口转换为业务错误。
- GitNexus Controller/service 为 LOW；共享调用方法虽 LOW 但影响 Changedoc 流程，本事件不修改。

## 2026-07-20：实现与验证

- 仅在 `AiConfigController.testProvider` 将 RuntimeException 转为统一 400/`AI_PROVIDER_TEST_FAILED`，未修改共享调用或业务 AI 生成。
- Java 21 14/14、生产构建/健康、真实 UI/API 1/1 通过。
- 预期上游失败仅保留 service 失败日志，无 `Unhandled exception`/5xx；provider 恢复，manifest 0/0。
- 事件提交 `97200a11`；待 no-ff 合并。
