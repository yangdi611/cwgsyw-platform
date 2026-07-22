# REM-P1-036 执行入口

仅在 `codex/rem-p1-036-login-error-feedback` 分支修复 `POST /api/auth/login` 的错误凭据 `401` 被全局会话失效重定向覆盖的问题。编辑前完成 GitNexus impact；保留其他会话无效的登出行为。完成 L1-L3、精确证据、`detect_changes` 后提交并 no-ff 合并到 `lint-fix`，再重新开始完整 L4。
