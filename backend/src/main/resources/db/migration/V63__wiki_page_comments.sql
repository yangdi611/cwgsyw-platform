-- Wiki 页面评论（轻量讨论，300 字上限，逻辑删除）
-- 评论不进入 Wiki 正文、版本历史或发布审批流程；权限复用页面 read ACL。
CREATE TABLE wiki_page_comment (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64)  NOT NULL DEFAULT 'default',
    page_id     BIGINT       NOT NULL,
    content     VARCHAR(300) NOT NULL,
    created_by  BIGINT,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_deleted  BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at  TIMESTAMP,
    deleted_by  BIGINT
);

CREATE INDEX idx_wiki_page_comment_page
    ON wiki_page_comment(page_id, created_at DESC, id DESC)
    WHERE NOT is_deleted;

CREATE INDEX idx_wiki_page_comment_tenant_page
    ON wiki_page_comment(tenant_id, page_id)
    WHERE NOT is_deleted;
