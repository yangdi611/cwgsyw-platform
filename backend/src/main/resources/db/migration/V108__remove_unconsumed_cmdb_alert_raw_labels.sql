-- Prometheus labels are parsed only during ingestion to resolve alert fields
-- and CI ownership. The raw JSON was never exposed, queried, or used by any
-- terminal workflow, so retaining it creates an uninspectable duplicate blob.
ALTER TABLE cmdb_alert DROP COLUMN raw_labels;
