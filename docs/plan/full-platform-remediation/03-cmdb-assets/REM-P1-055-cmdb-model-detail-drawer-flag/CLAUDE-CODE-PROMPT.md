# REM-P1-055 执行入口

按全局 Codex Goal、根 `AGENTS.md` 和本目录 SPEC，只修复 CMDB 模型详情遗漏 `isDrawerShow` 的 DTO 映射。

先读取失败 snapshot 与当前 run 台账，对拟修改符号执行 upstream impact。仅在独立分支补齐映射及定向测试；不得修改 schema、权限、租户、路由、查询键、属性写入语义或前端布局。依次完成 L1 映射/序列化、L2 CMDB 聚类、L3 当前分支 backend 构建/替换和真实组合 Playwright；夹具仅通过产品 API 逆序清理。同步五件套、全局索引、覆盖矩阵和 checkpoint，提交前运行 GitNexus detect；事件提交后 `--no-ff` 合并到最新 `lint-fix`，再恢复同一 L4 run 的受影响范围。任何新增产品语义、高风险授权、restore 或不可逆数据操作立即停止请求用户决定。
