# REM-P1-063 执行入口

本事件只处理 AI Provider 管理测试连接的错误合同。先读根 Goal、检查点、SPEC、VERIFICATION；编辑前 GitNexus impact，提交前 detect_changes。

必须证明成功 200、失败 400/稳定 errorCode、真实 UI 成功/失败反馈、无密钥泄露、无未处理 500、配置恢复和 manifest 0/0。不得改变业务 AI 生成异常语义，不得 SQL 写入、restore、Redis/卷清空或授权切换。L1-L3 后独立提交、no-ff 合并，再同 run 重验 AI-003。
