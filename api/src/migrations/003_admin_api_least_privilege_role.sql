-- 003_admin_api_least_privilege_role.sql
--
-- ############################################################################################
-- ##  DESIGN ONLY — DO NOT APPLY TO ANY ENVIRONMENT WITHOUT RUNNING THE VERIFICATION FIRST.  ##
-- ##  This is the change most likely to cause an outage in the whole remediation programme.  ##
-- ############################################################################################
--
-- B4 / finding A3 — stop the admin API connecting as the table owner.
--
-- TODAY
--   pre-prod: reportalignadmin — BYPASSRLS, owns all 204 tables
--   prod:     starkchowder2   — BYPASSRLS, owns all 202 tables
--
--   Cross-tenant READ access is legitimate for an administration tool. Schema modification,
--   table truncation and object ownership are not. As configured, a defect in this API is not
--   bounded by the database in any way: it can drop tables, not merely read rows.
--
-- THE DESIGN
--   A role that is NOT the owner and NOT the migration role, holding only the operations the code
--   actually performs, with BYPASSRLS granted EXPLICITLY so cross-tenant reach is a visible,
--   deliberate decision rather than a side effect of reusing the owner account.
--
-- HOW THE GRANT SET WAS DERIVED — and why it is not yet trustworthy
--   scripts/enumerate-db-operations.js statically analyses the SQL in src/. Its first pass pairs
--   quotes to find string literals, and a stray apostrophe in a prose comment ("each handler's
--   order") shifted that pairing and silently swallowed the SQL after it. That lost three real
--   writes — super_administrators:UPDATE, organization_users:UPDATE and users:UPDATE — every one
--   of which would have become a runtime failure AFTER cutover, in production, on the login path.
--
--   A second raw-text sweep now cross-checks the first and surfaced exactly those three. The list
--   below includes them. But the lesson stands: a statically derived grant set is a hypothesis.
--   scripts/verify-admin-role-privileges.js connects AS this role and exercises every operation;
--   run it and get a clean result BEFORE pointing any environment at this role.
--
-- WHAT THIS DELIBERATELY DOES NOT GRANT
--   No CREATE, no DDL, no TRUNCATE, no ownership. If the API is ever compromised, the blast
--   radius becomes "read and write these 23 tables" rather than "do anything to the schema".
--
-- IDEMPOTENT: role creation guarded, grants re-assertable.
-- DOWN MIGRATION: rollback/003_admin_api_least_privilege_role_rollback.sql

DO $$
DECLARE
  v_role text := 'execsponsor_admin_api';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_role) THEN
    -- No password set here. Assign one out of band and store it in Key Vault; a password in a
    -- migration file is the very problem finding A1 is about.
    EXECUTE format('CREATE ROLE %I WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT', v_role);
    RAISE NOTICE 'created role %', v_role;
  ELSE
    RAISE NOTICE 'role % already exists', v_role;
  END IF;

  -- Cross-tenant reach, granted explicitly and visibly rather than inherited from ownership.
  EXECUTE format('ALTER ROLE %I BYPASSRLS', v_role);

  EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), v_role);
  EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', v_role);
END
$$;

-- ---------------------------------------------------------------------------------------------
-- Read-only tables
--
-- NOTE: `stakeholders` was in the first draft of this list and does not exist. The cross-check
-- sweep matched the prose "Decisions needed from stakeholders" as `FROM <table>` — a false
-- positive from the deliberately over-approximating pass. It failed the migration on first apply
-- rather than silently over-granting, which is the direction that sweep is meant to fail in.
-- ---------------------------------------------------------------------------------------------
GRANT SELECT ON TABLE
  public.ai_usage_log,
  public.nps_surveys,
  public.programme_team_members,
  public.programmes,
  public.reports,
  public.security_events
TO execsponsor_admin_api;

-- ---------------------------------------------------------------------------------------------
-- Read/write tables — only the operations the code actually performs
-- ---------------------------------------------------------------------------------------------
GRANT SELECT, UPDATE                 ON TABLE public.ai_prompt_templates       TO execsponsor_admin_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contradiction_rules       TO execsponsor_admin_api;
GRANT INSERT                         ON TABLE public.key_indicators            TO execsponsor_admin_api;
GRANT SELECT, INSERT, UPDATE         ON TABLE public.maintenance_windows       TO execsponsor_admin_api;
GRANT INSERT                         ON TABLE public.organization_settings     TO execsponsor_admin_api;
GRANT SELECT, INSERT, UPDATE         ON TABLE public.organization_users        TO execsponsor_admin_api;
GRANT SELECT, INSERT, UPDATE         ON TABLE public.organizations             TO execsponsor_admin_api;
GRANT SELECT, INSERT                 ON TABLE public.platform_config           TO execsponsor_admin_api;
GRANT INSERT                         ON TABLE public.portfolio_grouping_config TO execsponsor_admin_api;
GRANT INSERT                         ON TABLE public.report_templates          TO execsponsor_admin_api;
GRANT SELECT, UPDATE                 ON TABLE public.super_administrators      TO execsponsor_admin_api;
GRANT SELECT, INSERT, UPDATE         ON TABLE public.system_broadcasts         TO execsponsor_admin_api;
GRANT SELECT, INSERT, UPDATE         ON TABLE public.users                     TO execsponsor_admin_api;
GRANT INSERT                         ON TABLE public.workflow_steps            TO execsponsor_admin_api;
GRANT INSERT                         ON TABLE public.workflow_transitions      TO execsponsor_admin_api;

-- The audit log is INSERT + SELECT only. No UPDATE, no DELETE, no TRUNCATE — deliberately, and
-- consistent with migration 002. Granting more here would undo that work.
GRANT SELECT, INSERT ON TABLE public.super_admin_audit_log TO execsponsor_admin_api;

-- Sequences backing the INSERTs above.
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO execsponsor_admin_api;

-- ---------------------------------------------------------------------------------------------
-- B4.4 — future migrations must not silently break this role.
--
-- Without this, a table created by a later migration is invisible to the admin API until someone
-- remembers to grant on it, and the failure appears as a production 500 rather than at deploy
-- time. SELECT only by default: a new table should have to justify write access explicitly.
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_owner text := current_user;
BEGIN
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT ON TABLES TO %I',
    v_owner, 'execsponsor_admin_api'
  );
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE ON SEQUENCES TO %I',
    v_owner, 'execsponsor_admin_api'
  );
END
$$;

-- ---------------------------------------------------------------------------------------------
-- Pre-existing over-grant, found by the verification script rather than by review.
--
-- `trial_emails_sent` carries SELECT and INSERT grants to PUBLIC, so EVERY role in the database
-- can read and write it — including this new least-privilege role, which would otherwise have
-- reached a table nobody intended it to reach. That is the one thing the verifier flagged as
-- outside the expected grant set, which is exactly what it exists to catch.
--
-- Safe to revoke: the application role holds its own explicit SELECT/INSERT/UPDATE/DELETE, so it
-- is unaffected. Only implicit PUBLIC access disappears.
-- ---------------------------------------------------------------------------------------------
REVOKE SELECT, INSERT ON TABLE public.trial_emails_sent FROM PUBLIC;
