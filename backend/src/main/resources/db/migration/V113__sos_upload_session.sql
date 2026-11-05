-- YAN-114: SOS 报告分片上传的临时会话。只新增对象，不修改现有表。

CREATE TABLE sos_upload_session (
    id                VARCHAR(36)  PRIMARY KEY,
    tenant_id         VARCHAR(64)  NOT NULL,
    file_name         VARCHAR(255) NOT NULL,
    file_size         BIGINT       NOT NULL,
    chunk_size        INT          NOT NULL,
    chunk_count       INT          NOT NULL,
    -- 浏览器算出的摘要，用于提前拒绝重复文件和校验合并结果。不支持时为空。
    expected_sha256   VARCHAR(64),
    status            VARCHAR(20)  NOT NULL DEFAULT 'uploading',
    report_id         BIGINT,
    created_by        BIGINT       NOT NULL,
    expires_at        TIMESTAMP    NOT NULL,
    created_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_sos_upload_session_status CHECK (status IN ('uploading', 'assembling', 'completed'))
);

CREATE INDEX idx_sos_upload_session_owner ON sos_upload_session (tenant_id, created_by, created_at);
CREATE INDEX idx_sos_upload_session_expiry ON sos_upload_session (expires_at);

COMMENT ON TABLE sos_upload_session IS '分片上传的临时状态，过期后连同分片一起物理删除，不含业务数据';
COMMENT ON COLUMN sos_upload_session.expires_at IS '到期后由定时任务清理分片和本行；收到分片时续期';
