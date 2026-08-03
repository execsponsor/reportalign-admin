-- Rollback: 002_audit_log_append_only.sql
--
-- Removes the append-only protection from super_admin_audit_log. After this runs, the audit log
-- is editable and deletable by the credential the API connects with again.
--
-- Roll this back only to unblock a genuine operational need (e.g. a redaction required by law).
-- Prefer re-applying 002 immediately afterwards.
--
-- IDEMPOTENT: IF EXISTS throughout; safe to run on a database that never had 002.

DROP TRIGGER IF EXISTS trg_super_admin_audit_log_no_truncate ON public.super_admin_audit_log;
DROP TRIGGER IF EXISTS trg_super_admin_audit_log_no_modify ON public.super_admin_audit_log;
DROP FUNCTION IF EXISTS public.super_admin_audit_log_is_append_only();

COMMENT ON TABLE public.super_admin_audit_log IS NULL;
