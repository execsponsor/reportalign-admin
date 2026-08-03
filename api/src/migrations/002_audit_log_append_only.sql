-- 002_audit_log_append_only.sql
-- B2 — make super_admin_audit_log append-only.
--
-- CORRECTION TO FINDING A2 — READ THIS FIRST
--   The security review reported this table as fully modifiable by the credential that writes it.
--   That was WRONG, and the error is worth recording: the review inspected pg_trigger and the
--   privilege grants, but never pg_rules. Two DO INSTEAD NOTHING rewrite rules already existed —
--   `super_admin_audit_log_no_update` and `super_admin_audit_log_no_delete` — so UPDATE and
--   DELETE were already blocked. Verified on pre-prod 2026-08-03: both are silently discarded
--   (rowCount 0, row unchanged, count unchanged at 40).
--
--   The genuine gap was narrower but real: **rules do not fire on TRUNCATE**, so a single
--   `TRUNCATE super_admin_audit_log` would have erased the entire audit trail. That is what this
--   migration actually closes.
--
--   The UPDATE/DELETE trigger below is therefore belt-and-braces, not the fix. Note it is
--   currently DEAD CODE for those two operations: the rules rewrite the statement away before any
--   row-level trigger is reached. It becomes live only if the rules are ever dropped — see
--   "RULES VERSUS TRIGGERS" below, which is a decision for the owner, not one taken here.
--
-- WHY THIS TABLE SPECIFICALLY
--   This API connects as the table-owning database role, which bypasses row-level security by
--   design: an administration tool legitimately needs cross-tenant reach. The audit log is the
--   compensating control for that — it is the only record of what a super administrator did.
--
-- RULES VERSUS TRIGGERS (a decision, deliberately NOT taken here)
--   The existing rules discard a write SILENTLY — no error, rowCount 0. An application bug that
--   tried to rewrite audit history would therefore fail quietly and look like success. A trigger
--   raises instead, which is far better for diagnosis, and PostgreSQL's own documentation
--   recommends triggers over rules. Swapping to triggers means dropping the two rules, which
--   changes behaviour: anything relying on the silent no-op would start erroring. That trade is
--   worth making, but it needs an owner's decision and a check of the callers first.
--
-- WHAT THIS ACTUALLY PREVENTS — read this before relying on it
--   A BEFORE UPDATE OR DELETE trigger stops the application, and anyone holding the application's
--   credential, from rewriting history through ordinary SQL. That is the realistic threat: a
--   compromised connection string, or an administrator covering their tracks with the access
--   they already have.
--
--   It does NOT make the log tamper-proof against the table's OWNER. An owner can
--   `ALTER TABLE ... DISABLE TRIGGER`, or drop the trigger, and then delete freely. Revoking
--   privileges does not help either — an owner can re-grant. There is no configuration of a
--   table that defends it against its own owner.
--
--   So this raises the bar from "a stray UPDATE succeeds silently" to "an attacker must first
--   disable a trigger, which is itself a schema change" — worthwhile, and honest about its limit.
--   The durable fix is shipping audit records to a sink the database credential cannot reach;
--   that is assessed in the accompanying report and deliberately not implemented here.
--
-- TRUNCATE IS COVERED SEPARATELY
--   A DELETE trigger does NOT fire on TRUNCATE — that is the classic hole in this pattern.
--   A statement-level BEFORE TRUNCATE trigger is therefore added as well.
--
-- IDEMPOTENT: functions use CREATE OR REPLACE; triggers are dropped and recreated.
-- DOWN MIGRATION: rollback/002_audit_log_append_only_rollback.sql

CREATE OR REPLACE FUNCTION public.super_admin_audit_log_is_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'super_admin_audit_log is append-only: % is not permitted', TG_OP
    USING HINT = 'Audit records are evidence. Add a compensating entry rather than editing history.',
          ERRCODE = 'insufficient_privilege';
  RETURN NULL;
END;
$$;

-- Row-level: blocks UPDATE and DELETE.
DROP TRIGGER IF EXISTS trg_super_admin_audit_log_no_modify ON public.super_admin_audit_log;
CREATE TRIGGER trg_super_admin_audit_log_no_modify
  BEFORE UPDATE OR DELETE ON public.super_admin_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.super_admin_audit_log_is_append_only();

-- Statement-level: blocks TRUNCATE, which the row trigger above never sees.
DROP TRIGGER IF EXISTS trg_super_admin_audit_log_no_truncate ON public.super_admin_audit_log;
CREATE TRIGGER trg_super_admin_audit_log_no_truncate
  BEFORE TRUNCATE ON public.super_admin_audit_log
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.super_admin_audit_log_is_append_only();

COMMENT ON TABLE public.super_admin_audit_log IS
  'Append-only (migration 002). UPDATE, DELETE and TRUNCATE raise. This is the compensating '
  'control for an API that bypasses RLS by design. Note the limit: the table owner can disable '
  'these triggers — see the migration header.';
