-- Rollback: 003_admin_api_least_privilege_role.sql
--
-- ORDER MATTERS. Repoint the application back at the previous role BEFORE running this, or the
-- admin API loses its database access mid-flight and every request fails.
--
--   1. Set DB_USER / DB_PASSWORD back to the previous credential in the Static Web App settings.
--   2. Restart / redeploy so the change takes effect.
--   3. Confirm the portal works.
--   4. Only then run this.
--
-- The role is dropped last because DROP ROLE fails while it owns objects or holds grants —
-- which is a useful safety net, not an obstacle to work around.
--
-- IDEMPOTENT: guarded throughout; safe on a database that never had 003.

DO $$
DECLARE
  v_role text := 'execsponsor_admin_api';
  v_owner text := current_user;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_role) THEN
    RAISE NOTICE 'role % does not exist — nothing to do', v_role;
    RETURN;
  END IF;

  -- Default privileges must be revoked in the same form they were granted, or they linger and
  -- silently re-grant on the next table creation.
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE SELECT ON TABLES FROM %I',
    v_owner, v_role
  );
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE USAGE ON SEQUENCES FROM %I',
    v_owner, v_role
  );

  EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', v_role);
  EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', v_role);
  EXECUTE format('REVOKE USAGE ON SCHEMA public FROM %I', v_role);
  EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM %I', current_database(), v_role);

  EXECUTE format('DROP ROLE %I', v_role);
  RAISE NOTICE 'dropped role %', v_role;
END
$$;
