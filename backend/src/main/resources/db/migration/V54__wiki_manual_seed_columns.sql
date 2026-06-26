-- V54: Wiki 手册 seed 标识列
-- seed_key：标识由 WikiManualSeeder 自动导入的空间/页面（同 space 内唯一），seeder 据此找到上次建的记录
-- seed_hash：页面内容 SHA-256，seeder 据此判断 md 是否变化、是否需要更新
-- 二者均可空：用户手建的空间/页面 seed_key 为 NULL，不受 seeder 管理

ALTER TABLE wiki_space ADD COLUMN IF NOT EXISTS seed_key  VARCHAR(255);
ALTER TABLE wiki_space ADD COLUMN IF NOT EXISTS seed_hash VARCHAR(64);

ALTER TABLE wiki_page  ADD COLUMN IF NOT EXISTS seed_key  VARCHAR(255);
ALTER TABLE wiki_page  ADD COLUMN IF NOT EXISTS seed_hash VARCHAR(64);

-- seeder 按 (space_id, seed_key) 定位页面，加部分唯一索引保证幂等且加速查找
CREATE UNIQUE INDEX IF NOT EXISTS uq_wiki_page_seed
    ON wiki_page(space_id, seed_key) WHERE seed_key IS NOT NULL AND NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_wiki_space_seed
    ON wiki_space(seed_key) WHERE seed_key IS NOT NULL AND NOT is_deleted;
