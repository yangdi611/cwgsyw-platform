# REM-P0-005 实施规格

## 已确认产品语义

有效 `super_admin@platform` assignment 的 platform 超级管理员绕过 Wiki、共享文件及共享文件夹的资源 ACL 和祖先 traverse。该绕过不替代功能 permission，也不适用于 tenant/group admin、document admin 或 break-glass。

## 不变量

1. 先验证资源存在且已迁移，再验证对应功能 permission 的有效 platform assignment。
2. platform 超级管理员只绕过资源层；缺失 `wiki:*` 或 `shared_file:*` 功能 permission 必须继续返回 `FUNCTION_PERMISSION_DENIED`。
3. Wiki、共享文件和共享文件夹的 ACL、owner、mode、祖先链语义对其他身份保持不变。
4. 绕过必须有独立 `platform_super_admin` resourceClass，供 Shadow 差异和运行时审计解释。
5. 不执行 Rollback、Enforce、break-glass 或非测试授权数据修改。

## 验收条件

- AC-001：有效 `super_admin@platform` 可读取受限 Wiki 页面，并在 Shadow 中与 legacy 同为 allow。
- AC-002：有效 `super_admin@platform` 可穿越受限 Wiki/共享文件祖先并访问资源，resourceClass 为 `platform_super_admin`。
- AC-003：仅有 platform scope 或仅有功能 permission、但没有有效 super_admin assignment 的用户仍按 ACL 拒绝。
- AC-004：缺少功能 permission 的 platform 超级管理员仍被拒绝。
- AC-005：L1 定向测试、L2 API、L3 当前分支容器/UI、strict preflight 及无业务写入检查通过。

## 回滚

撤销本事件代码提交即可恢复原资源 ACL 裁决；不涉及数据迁移或授权配置写入。
