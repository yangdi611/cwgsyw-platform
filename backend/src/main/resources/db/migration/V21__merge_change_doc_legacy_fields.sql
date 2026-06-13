-- V21: Merge ChangeDoc legacy column data into fieldsData JSONB
-- This is the first step of Phase 3 entity cleanup.
-- If fieldsData already has a key with the same name, the existing value is preserved
-- (COALESCE + JSONB concatenation semantics).
--
-- This migration is append-only (no destructive operations) and fully reversible.
-- Just revert the commit if rollback is needed.

UPDATE change_doc
SET fields_data =
    COALESCE(fields_data, '{}'::jsonb) ||
    jsonb_strip_nulls(jsonb_build_object(
        'changeDesc',       change_desc,
        'impactScope',      impact_scope,
        'changeWindow',     change_window,
        'resourceSupport',  resource_support,
        'background',       background,
        'steps',            steps,
        'riskAssessment',   risk_assessment,
        'rollbackPlan',     rollback_plan,
        'verifyMethod',     verify_method,
        'contacts',         contacts
    ))
WHERE fields_data IS NULL
   OR NOT (fields_data ? 'changeDesc')
   OR NOT (fields_data ? 'impactScope')
   OR NOT (fields_data ? 'changeWindow')
   OR NOT (fields_data ? 'resourceSupport')
   OR NOT (fields_data ? 'background')
   OR NOT (fields_data ? 'steps')
   OR NOT (fields_data ? 'riskAssessment')
   OR NOT (fields_data ? 'rollbackPlan')
   OR NOT (fields_data ? 'verifyMethod')
   OR NOT (fields_data ? 'contacts')
;
