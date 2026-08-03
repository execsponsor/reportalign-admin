/**
 * B4.3 — prove the least-privilege admin role has exactly the privileges the API needs.
 *
 * Modelled on the backend's verify-app-role-privileges.js. Reports BOTH directions:
 *   MISSING — the API would fail at runtime. This is the outage case; it must be empty.
 *   EXCESS  — the role can do more than the code needs. Not an outage, but it is the whole
 *             point of the exercise, so it is reported rather than quietly tolerated.
 *
 * Uses has_table_privilege() rather than attempting real writes: it answers the question exactly,
 * touches no data, and cannot leave anything behind.
 *
 *   node api/scripts/verify-admin-role-privileges.js
 *
 * Connection: an admin/owner URL (it inspects another role's privileges, it does not log in as it).
 * USE_PG_ENV=1 with PG* variables, or ADMIN_DATABASE_URL / TEST_ADMIN_DATABASE_URL / DATABASE_URL.
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) { return; }
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    const eq = line.indexOf('=');
    if (!line || line.startsWith('#') || eq < 1) { continue; }
    const key = line.slice(0, eq);
    if (!/^[A-Z0-9_]+$/.test(key) || process.env[key]) { continue; }
    process.env[key] = line.slice(eq + 1).replace(/^["']|["']$/g, '');
  }
}
loadEnvFile(path.join(__dirname, '..', '..', '..', 'reportalign-backend', '.env'));

const ROLE = process.env.ADMIN_API_ROLE || 'execsponsor_admin_api';

/** The intended grant set — must match migration 003. Derived by enumerate-db-operations.js. */
const EXPECTED = {
  ai_usage_log: ['SELECT'],
  nps_surveys: ['SELECT'],
  programme_team_members: ['SELECT'],
  programmes: ['SELECT'],
  reports: ['SELECT'],
  security_events: ['SELECT'],
  ai_prompt_templates: ['SELECT', 'UPDATE'],
  contradiction_rules: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  key_indicators: ['INSERT'],
  maintenance_windows: ['SELECT', 'INSERT', 'UPDATE'],
  organization_settings: ['INSERT'],
  organization_users: ['SELECT', 'INSERT', 'UPDATE'],
  organizations: ['SELECT', 'INSERT', 'UPDATE'],
  platform_config: ['SELECT', 'INSERT'],
  portfolio_grouping_config: ['INSERT'],
  report_templates: ['INSERT'],
  super_administrators: ['SELECT', 'UPDATE'],
  system_broadcasts: ['SELECT', 'INSERT', 'UPDATE'],
  users: ['SELECT', 'INSERT', 'UPDATE'],
  workflow_steps: ['INSERT'],
  workflow_transitions: ['INSERT'],
  super_admin_audit_log: ['SELECT', 'INSERT'],
};

const ALL_OPS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];

async function main() {
  const useEnv = process.env.USE_PG_ENV === '1';
  const connectionString = useEnv
    ? undefined
    : (process.env.ADMIN_DATABASE_URL || process.env.TEST_ADMIN_DATABASE_URL || process.env.DATABASE_URL);
  if (!useEnv && !connectionString) { console.error('No connection available.'); process.exit(2); }

  const c = new Client(
    useEnv ? { ssl: { rejectUnauthorized: false } } : { connectionString, ssl: { rejectUnauthorized: false } }
  );
  await c.connect();

  const { rows: [me] } = await c.query('SELECT current_database() db, current_user role');
  console.log(`Target: ${me.db} as ${me.role}\nInspecting role: ${ROLE}\n`);

  const { rows: role } = await c.query(
    `SELECT rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
       FROM pg_roles WHERE rolname = $1`, [ROLE]
  );
  if (!role.length) {
    console.error(`Role ${ROLE} does not exist. Migration 003 has not been applied here.`);
    console.error('That is expected until the design is signed off — nothing else to check.');
    await c.end();
    process.exit(1);
  }

  const r = role[0];
  console.log(`  superuser : ${r.rolsuper}   (must be false)`);
  console.log(`  bypassrls : ${r.rolbypassrls}   (must be true — cross-tenant reach, granted explicitly)`);
  console.log(`  createdb  : ${r.rolcreatedb}   createrole: ${r.rolcreaterole}   (both must be false)\n`);

  const attrProblems = [];
  if (r.rolsuper) { attrProblems.push('role is SUPERUSER — defeats the entire exercise'); }
  if (!r.rolbypassrls) { attrProblems.push('role lacks BYPASSRLS — cross-tenant reads will silently return nothing'); }
  if (r.rolcreatedb) { attrProblems.push('role has CREATEDB'); }
  if (r.rolcreaterole) { attrProblems.push('role has CREATEROLE'); }

  // Does it own anything? Ownership re-introduces exactly what this migration removes.
  const { rows: owned } = await c.query(
    `SELECT count(*)::int n FROM pg_class WHERE relowner = (SELECT oid FROM pg_roles WHERE rolname = $1)`,
    [ROLE]
  );
  console.log(`  objects owned: ${owned[0].n}   (must be 0 — ownership would restore DDL rights)\n`);
  if (owned[0].n > 0) { attrProblems.push(`role owns ${owned[0].n} object(s)`); }

  const missing = [];
  const excess = [];

  for (const [table, expectedOps] of Object.entries(EXPECTED)) {
    const { rows: exists } = await c.query(`SELECT to_regclass($1) IS NOT NULL AS present`, [`public.${table}`]);
    if (!exists[0].present) {
      missing.push(`${table}: TABLE DOES NOT EXIST (the expected set is stale)`);
      continue;
    }
    for (const op of ALL_OPS) {
      const { rows } = await c.query(`SELECT has_table_privilege($1, $2, $3) AS granted`,
        [ROLE, `public.${table}`, op]);
      const granted = rows[0].granted;
      const wanted = expectedOps.includes(op);
      if (wanted && !granted) { missing.push(`${table}: ${op}`); }
      if (!wanted && granted) { excess.push(`${table}: ${op}`); }
    }
  }

  // Anything granted on a table NOT in the expected set at all.
  const { rows: extras } = await c.query(
    `SELECT c.relname
       FROM pg_class c
      WHERE c.relkind = 'r' AND c.relnamespace = 'public'::regnamespace
        AND has_table_privilege($1, c.oid, 'SELECT,INSERT,UPDATE,DELETE')
        AND NOT (c.relname = ANY($2))
      ORDER BY c.relname`,
    [ROLE, Object.keys(EXPECTED)]
  );

  console.log(`MISSING (would fail at runtime): ${missing.length}`);
  missing.forEach((m) => console.log(`   ${m}`));
  console.log(`\nEXCESS (more than the code needs): ${excess.length}`);
  excess.slice(0, 40).forEach((e) => console.log(`   ${e}`));
  console.log(`\nTables outside the expected set with any privilege: ${extras.length}`);
  extras.slice(0, 40).forEach((e) => console.log(`   ${e.relname}`));

  if (attrProblems.length) {
    console.log('\nROLE ATTRIBUTE PROBLEMS:');
    attrProblems.forEach((p) => console.log(`   ${p}`));
  }

  const fatal = missing.length > 0 || attrProblems.length > 0;
  console.log(
    `\n${fatal ? 'NOT SAFE TO CUT OVER' : 'Grant set satisfies the code.'}` +
    `${excess.length || extras.length ? ' (excess privileges above are worth trimming.)' : ''}`
  );
  await c.end();
  process.exit(fatal ? 1 : 0);
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(2); });
