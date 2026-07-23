-- AI provider configuration remains an active product capability. The call-log
-- table, however, has no query, retention, audit, or operational consumer.
-- Remove the orphaned telemetry instead of retaining credentials-adjacent data
-- without a defined platform purpose.
DROP TABLE ai_call_log;
