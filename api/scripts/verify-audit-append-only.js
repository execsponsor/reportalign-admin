/**
 * B2.4 — prove super_admin_audit_log is append-only.
 *
 * Every check runs inside a transaction that is ALWAYS rolled back, so it neither leaves a test
 * record behind nor risks deleting a real one. It asserts what the control does AND what it does
 * not: the final check demonstrates that the table owner can still disable the trigger, because
 * a control whose limits are undocumented gets over-trusted.
 *
 *   node api/scripts/verify-audit-append-only.js
 *
 * Connection: ADMIN_DATABASE_URL, else TEST_ADMIN_DATABASE_URL / DATABASE_URL.
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// The admin API has no local.settings.json checked in and does not depend on dotenv, so read the
// backend repo's .env directly rather than adding a dependency just for a verification script.
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

const results = [];
function record(name, passed, detail) {
  results.push({ name, passed, detail });
  console.log(`  ${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  // USE_PG_ENV=1 makes pg read the standard libpq variables, so a production credential never has
  // to be interpolated into a URL in the shell.
  const useEnv = process.env.USE_PG_ENV === '1';
  const connectionString = useEnv
    ? undefined
    : (process.env.ADMIN_DATABASE_URL || process.env.TEST_ADMIN_DATABASE_URL || process.env.DATABASE_URL);
  if (!useEnv && !connectionString) { console.error('No connection string available.'); process.exit(2); }

  const c = new Client(
    useEnv ? { ssl: { rejectUnauthorized: false } } : { connectionString, ssl: { rejectUnauthorized: false } }
  );
  await c.connect();
  const { rows: [me] } = await c.query('SELECT current_database() db, current_user role');
  console.log(`Target: ${me.db} as ${me.role}\n`);

  // Guard: the triggers must actually exist, or every "blocked" result below is meaningless.
  const { rows: trg } = await c.query(
    `SELECT tgname FROM pg_trigger
      WHERE tgrelid = 'public.super_admin_audit_log'::regclass AND NOT tgisinternal
      ORDER BY tgname`
  );
  record('triggers are installed', trg.length === 2, trg.map((t) => t.tgname).join(', ') || 'none');
  if (trg.length !== 2) {
    console.error('\nMigration 002 is not applied here — nothing below would prove anything.');
    await c.end();
    process.exit(1);
  }

  // The pre-existing protection. Report it explicitly: the original review missed these because
  // it inspected pg_trigger and privileges but never pg_rules, and consequently overstated the
  // finding. UPDATE/DELETE were already blocked before migration 002 was written.
  const { rows: rules } = await c.query(
    `SELECT rulename FROM pg_rules WHERE schemaname = 'public' AND tablename = 'super_admin_audit_log' ORDER BY rulename`
  );
  record('pre-existing DO INSTEAD NOTHING rules present', rules.length === 2,
    rules.map((r) => r.rulename).join(', ') || 'none');

  const { rows: sa } = await c.query('SELECT id FROM super_administrators LIMIT 1');
  if (!sa.length) { console.error('No super_administrators row to attribute the test insert to.'); await c.end(); process.exit(2); }
  const saId = sa[0].id;

  // ---- INSERT still works (an append-only log that cannot append is just broken) --------------
  await c.query('BEGIN');
  try {
    const r = await c.query(
      `INSERT INTO super_admin_audit_log (super_admin_id, action_type, target_type, target_id, reason)
       VALUES ($1, 'verify.append_only', 'test', $1, 'B2.4 verification - rolled back') RETURNING id`,
      [saId]
    );
    record('INSERT is permitted', r.rowCount === 1, `id ${String(r.rows[0].id).slice(0, 8)}...`);

    // "No exception" does NOT mean "not blocked". The pre-existing DO INSTEAD NOTHING rules
    // silently rewrite the statement away, so a blocked UPDATE returns rowCount 0 and no error.
    // Assert on the OUTCOME (the row is unchanged), not on whether something threw — otherwise
    // this check would have reported a failure while the table was in fact protected.
    try {
      const u = await c.query(`UPDATE super_admin_audit_log SET reason = 'tampered' WHERE id = $1`, [r.rows[0].id]);
      const { rows: after } = await c.query('SELECT reason FROM super_admin_audit_log WHERE id = $1', [r.rows[0].id]);
      const unchanged = after.length === 1 && after[0].reason !== 'tampered';
      record('UPDATE does not modify the record', unchanged,
        unchanged ? `silently discarded by rule (rowCount ${u.rowCount})` : 'THE ROW WAS MODIFIED');
    } catch (e) {
      record('UPDATE does not modify the record', true, `raised: ${e.message.split('\n')[0].slice(0, 60)}`);
    }
  } finally {
    await c.query('ROLLBACK');
  }

  // ---- DELETE ----------------------------------------------------------------------------------
  await c.query('BEGIN');
  try {
    const { rows: [before] } = await c.query('SELECT count(*)::int n FROM super_admin_audit_log');
    await c.query('DELETE FROM super_admin_audit_log WHERE id = (SELECT id FROM super_admin_audit_log LIMIT 1)');
    const { rows: [after] } = await c.query('SELECT count(*)::int n FROM super_admin_audit_log');
    record('DELETE does not remove records', before.n === after.n,
      before.n === after.n ? `count unchanged at ${before.n}` : `count fell ${before.n} -> ${after.n}`);
  } catch (e) {
    record('DELETE does not remove records', true, `raised: ${e.message.split('\n')[0].slice(0, 60)}`);
  } finally {
    await c.query('ROLLBACK');
  }

  // ---- TRUNCATE blocked (the hole a DELETE trigger alone leaves open) --------------------------
  await c.query('BEGIN');
  try {
    await c.query('TRUNCATE super_admin_audit_log');
    record('TRUNCATE is blocked', false, 'the truncate SUCCEEDED');
  } catch (e) {
    record('TRUNCATE is blocked', /append-only/.test(e.message), e.message.split('\n')[0].slice(0, 70));
  } finally {
    await c.query('ROLLBACK');
  }

  // ---- The documented LIMIT: an owner can disable the trigger. Shown, then rolled back. --------
  await c.query('BEGIN');
  let ownerCanBypass = false;
  try {
    await c.query('ALTER TABLE super_admin_audit_log DISABLE TRIGGER trg_super_admin_audit_log_no_modify');
    await c.query('UPDATE super_admin_audit_log SET reason = reason WHERE id = (SELECT id FROM super_admin_audit_log LIMIT 1)');
    ownerCanBypass = true;
  } catch {
    ownerCanBypass = false;
  } finally {
    await c.query('ROLLBACK');
  }
  console.log(
    `\n  NOTE  owner can disable the trigger and write: ${ownerCanBypass ? 'YES' : 'no'} - ` +
    'expected, and the documented limit of this control rather than a defect in it.'
  );

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${failed.length === 0 ? 'ALL CHECKS PASSED' : `${failed.length} CHECK(S) FAILED`}`);
  await c.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(2); });
