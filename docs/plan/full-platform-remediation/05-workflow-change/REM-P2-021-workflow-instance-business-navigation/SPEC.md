# REM-P2-021 实施合同

## 目标与不变量

在流程实例列表中，`businessKey` 恰为 `daily_report:<正整数>` 时提供到 `/daily/<id>` 的链接。非日报、空值和不合法键继续按原样文本显示。不得猜测、解析或跳转未知业务类型；不增加读写 API 或权限。

## 根因与影响

`InstancesPage` 直接渲染 `businessKey` 字符串。GitNexus upstream impact（2026-07-17）显示该符号 direct callers=0、affected processes=0、risk=`LOW`；仅影响当前页面的行呈现。

## 实施

1. 新增页面内纯解析辅助函数，仅识别严格日报键。
2. 将业务标识列对可识别日报键渲染为现有 `Link` 跳转；其余保持 monospace 文本。
3. 不修改 API、数据库、历史实例或权限守卫。

## 验收条件

- AC-001：`daily_report:1` 在流程实例列表显示为可访问的 `/daily/1` 链接。
- AC-002：`rem024-running` 等非日报键仍为非链接文本。
- AC-003：运行/完成实例读取、活动历史及状态不回归，页面无 Console 或 4xx/5xx。

## 回滚

回退本事件单一前端提交即可恢复原文本渲染；无数据迁移或服务端状态。
