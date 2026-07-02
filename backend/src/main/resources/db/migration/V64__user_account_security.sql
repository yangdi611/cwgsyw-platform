-- 用户账号安全增强：首次登录强制流程 + 密码历史 + 登录审计字段
-- 来源 SPEC: docs/plan/users/SPEC.md 第 5 节
-- 说明：
--   * 历史用户 must_change_password = false，避免上线后全员被迫改密
--   * profile_completed 按 email + phone 是否都存在真实计算；requiredActions 是否强制
--     补全 profile 由配置 security.account.forceExistingUsersCompleteProfile 控制
--   * 不做物理删除、时间字段统一 TIMESTAMP（见 CLAUDE.md 数据库约定）

-- ── sys_user 扩展 ────────────────────────────────────────────────────────
ALTER TABLE sys_user
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_sys_user_profile_completed
  ON sys_user(tenant_id, profile_completed)
  WHERE NOT is_deleted;

CREATE INDEX IF NOT EXISTS idx_sys_user_last_login
  ON sys_user(tenant_id, last_login_at DESC)
  WHERE NOT is_deleted;

-- 历史用户初始化：不强制改密（列为 NOT NULL DEFAULT FALSE，已满足，无需再改）
-- profile_completed 按真实数据计算（新列默认 FALSE，此处对存量用户按 email+phone 回填真实值）
UPDATE sys_user
SET profile_completed = CASE
  WHEN email IS NOT NULL AND btrim(email) <> ''
   AND phone IS NOT NULL AND btrim(phone) <> ''
  THEN TRUE
  ELSE FALSE
END;

-- ── 密码历史表 ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys_user_password_history (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    user_id BIGINT NOT NULL REFERENCES sys_user(id),
    password_hash VARCHAR(128) NOT NULL,
    source VARCHAR(32) NOT NULL,          -- CREATE_USER | RESET_PASSWORD | CHANGE_PASSWORD
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT
);

CREATE INDEX IF NOT EXISTS idx_user_password_history_user
    ON sys_user_password_history(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_password_history_tenant
    ON sys_user_password_history(tenant_id, user_id, created_at DESC);
