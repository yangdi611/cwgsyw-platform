-- 拆分 is_list_show：增加 is_drawer_show 控制详情抽屉 "关键属性" 区块的显示。
-- 现有数据 backfill：is_drawer_show = is_list_show，保留当前行为，避免回归。

ALTER TABLE ci_attribute
    ADD COLUMN IF NOT EXISTS is_drawer_show BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE ci_attribute
   SET is_drawer_show = is_list_show
 WHERE is_drawer_show = FALSE
   AND is_list_show = TRUE;
