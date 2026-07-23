-- Task relations retain their immutable graph lineage and creation order, but
-- never expose, authorize, or audit against a separate creator identity.
-- Automated relation provenance is authoritatively recorded by the linked
-- automation execution; manual operation history remains in audit_log.
ALTER TABLE task_relation
    DROP COLUMN created_by;
