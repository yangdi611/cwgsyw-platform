# REM-P1-062 实施合同

## 目标

AI Provider 的 baseUrl、model、apiKey 和 systemPrompt 在写入前完成稳定边界校验，非法请求返回 HTTP 400 且配置快照不变。

## 范围

- Controller 启用 DTO `@Valid`。
- DTO 限制字符串长度。
- service 规范化 baseUrl/model 并验证 HTTP(S) 绝对 URL、非空 model 和长度。
- API/单测覆盖合法、非法、无部分写入、密钥掩码/留空不修改和测试连接反馈。

## 非目标

不改变 Provider 列表、选择顺序、加密算法、调用协议、日志、AI 业务生成、数据库结构或全租户配置。

## 验收

| ID | 合同 |
|---|---|
| AC-001 | 空白/非法 scheme/无 host baseUrl 返回 400，快照不变。 |
| AC-002 | 空白/超长 model、超长 key/prompt 返回 400，快照不变。 |
| AC-003 | 合法 URL 去尾斜杠、model trim 后保存；留空或掩码 key 不覆盖原密钥。 |
| AC-004 | 隔离 mock 成功与业务失败均给出明确反馈且不泄露 key。 |
| AC-005 | 配置精确恢复，manifest 零对象、零失败。 |

## GitNexus 影响

- `AiConfigController.saveProvider`：LOW，无上游或已索引流程。
- `AiGatewayService.saveProviderConfig`：LOW，仅 1 个 Controller 调用者。
- `SaveAiProviderConfigRequest`：LOW，2 个直接 import，间接 Changedoc/Search/Workflow 文件依赖。

## 回滚

回滚事件提交即可恢复旧输入行为；无迁移、授权切换或历史数据改写。
