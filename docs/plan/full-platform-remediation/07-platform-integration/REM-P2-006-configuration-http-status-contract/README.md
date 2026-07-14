# REM-P2-006：通用配置拒绝的 HTTP 与业务码一致性

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P2-006` |
| 优先级 | P2 |
| 领域 | `07-platform-integration` |
| 状态 | `NOT_STARTED` |
| 风险 | `LOW` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

通用配置白名单拒绝通过 R.fail(String) 返回 HTTP 200、body code 500。

客户端、监控和审计无法按 HTTP 状态识别拒绝。

## 追溯

- 缺陷：`BUG-FQA-022`
- 用例：`SYSTEM-CONFIG-READ-BOUNDARY`
- 原始记录：`docs/acceptance/full-platform-exhaustive-functional-test-v1.0/runs/FQA_20260712_0329_lintfix/defects.md`
- 原始证据：`test-results/FQA_20260712_0329_lintfix/` 下对应 case 目录；原证据保持只读。

## 边界

根因聚类：Controller 使用了只设置业务码的响应重载，没有映射明确的客户端错误状态。

范围：
- 为白名单与参数拒绝返回稳定 4xx
- 统一相邻配置端点错误结构
- 保留成功响应合同

非目标：
- 不扩大通用配置白名单
- 不修改配置值
- 不测试外部 SMTP/Prometheus

下一门禁：实施前逐符号 GitNexus upstream impact；`HIGH/CRITICAL` 先告警。完成 L1-L3 后进入 L4 全量 FQA。

文件导航：[SPEC](./SPEC.md) / [验证矩阵](./VERIFICATION.md) / [实施记录](./IMPLEMENTATION-RECORD.md) / [执行 Prompt](./CLAUDE-CODE-PROMPT.md)
