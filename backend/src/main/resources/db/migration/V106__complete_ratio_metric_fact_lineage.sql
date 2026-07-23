-- A ratio metric needs both operands and their immutable field-fact lineage.
-- V87 added numerator/denominator placeholders but no producer, making the
-- ratio aggregation path unusable. Ratio bindings now declare their component
-- and each metric fact records the paired denominator source.

ALTER TABLE task_metric_binding
    ADD COLUMN ratio_component VARCHAR(16);

ALTER TABLE task_metric_fact
    ADD COLUMN denominator_field_fact_id BIGINT REFERENCES task_field_fact(id),
    ALTER COLUMN value DROP NOT NULL;

ALTER TABLE task_metric_binding
    ADD CONSTRAINT ck_task_metric_binding_ratio_component
    CHECK (ratio_component IS NULL OR ratio_component IN ('numerator', 'denominator'));

CREATE UNIQUE INDEX uq_task_metric_binding_ratio_component
    ON task_metric_binding(metric_id, template_version_id, source_role, ratio_component)
    WHERE ratio_component IS NOT NULL;

CREATE INDEX idx_task_metric_fact_denominator_lineage
    ON task_metric_fact(denominator_field_fact_id)
    WHERE denominator_field_fact_id IS NOT NULL;
