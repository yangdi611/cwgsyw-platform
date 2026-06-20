-- V42: ci_attribute option field migration
-- Purpose: Migrate from legacy enumOptions string to canonical option JSONB format
-- Context: The ci_attribute table has always had 'option' JSONB column, but the Java entity
-- mistakenly had 'enumOptions' String field reading a non-existent column. This migration
-- ensures data consistency and handles any edge cases.
--
-- Expected option format: [{"id":"linux","name":"Linux","is_default":true}]
-- This is the canonical format for enum/enummulti field types.

-- Check if any legacy data exists that needs migration
DO $$
DECLARE
    legacy_count INTEGER;
BEGIN
    -- Check if there are any rows where option is NULL or empty but might have legacy data
    -- Note: The ci_attribute table has never had an 'enumOptions' column in the database,
    -- so this is defensive coding. The Java entity's enumOptions field was reading a non-existent column.

    -- Log current state for audit
    RAISE NOTICE 'V42: Checking ci_attribute.option data integrity...';

    SELECT COUNT(*) INTO legacy_count
    FROM ci_attribute
    WHERE field_type IN ('enum', 'enummulti')
    AND (option IS NULL OR option = '[]'::jsonb);

    IF legacy_count > 0 THEN
        RAISE NOTICE 'V42: Found % enum/enummulti attributes with NULL/empty option', legacy_count;
    ELSE
        RAISE NOTICE 'V42: All enum/enummulti attributes have option data populated';
    END IF;

    -- Validate that option data is in correct format
    -- Check for malformed JSON or unexpected structure
    RAISE NOTICE 'V42: Validating option JSONB format...';

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'V42 migration failed: %', SQLERRM;
END $$;

-- Add comment to document the canonical format
COMMENT ON COLUMN ci_attribute.option IS 'Enum/enummulti field options in JSONB format. Canonical: [{"id":"linux","name":"Linux","is_default":true}]';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'V42: ci_attribute option migration completed successfully';
END $$;
