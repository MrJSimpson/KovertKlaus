/**
 * @file check-db-schema-separation.ts
 * @description Read-only audit that proves the database honours the `app` / `admin`
 * schema separation declared in `prisma/schema.prisma`.
 *
 * Tier 1 (what): Connects with the owner/admin connection string, opens a
 * READ ONLY transaction and checks that:
 *   1. No application tables or enums remain in `public`.
 *   2. Every table lives in the schema its Prisma model declares via `@@schema`.
 *   3. The application role (default `kovert_app`) can use the `app` schema,
 *      cannot enter the `admin` schema, holds no privileges on any admin table,
 *      holds at least SELECT on every app table, and is covered by the default
 *      privileges that auto-grant future app tables.
 * Tier 2 (why): Postgres grants nothing on new tables and Prisma never issues
 * GRANTs. Schema separation makes access a property of a table's location; this
 * script catches setup drift (a table in the wrong schema, a missing default
 * privilege, an accidental admin grant) before users hit "permission denied" or,
 * worse, before the app role can read admin data.
 * Tier 3 (how): `npx tsx scripts/check-db-schema-separation.ts`. Uses
 * DATABASE_ADMIN_URL, then DIRECT_URL, then DATABASE_URL. Override the role with
 * APP_DB_ROLE. Exits 0 when clean and 1 on any finding. Role checks are skipped
 * (with a notice) when the role does not exist, e.g. local single-role Docker.
 */
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

/** Schema names the application data is split across. */
type TargetSchema = 'app' | 'admin';

/** A single audit failure, printed and counted toward the exit code. */
interface Finding {
  check: string;
  detail: string;
}

/**
 * Parses `prisma/schema.prisma` and maps every model to its `@@schema`.
 *
 * Tier 1: Returns a Map of model name to declared schema.
 * Tier 2: Treats the Prisma schema as the single source of truth for placement,
 * so the database is judged against the code rather than a hand-kept list.
 * Tier 3: Models without `@@schema` map to `undefined` and are reported as findings.
 */
function readDeclaredSchemas(schemaPath: string): Map<string, TargetSchema | undefined> {
  const source = fs.readFileSync(schemaPath, 'utf8');
  const declared = new Map<string, TargetSchema | undefined>();
  const blockPattern = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  for (const match of source.matchAll(blockPattern)) {
    const schema = /@@schema\("(\w+)"\)/.exec(match[2])?.[1] as TargetSchema | undefined;
    declared.set(match[1], schema);
  }
  return declared;
}

/**
 * Runs every audit check inside a READ ONLY transaction.
 *
 * Tier 1: Collects findings for placement, public-schema leftovers and role access.
 * Tier 2: READ ONLY guarantees the audit can never modify production, even by mistake.
 * Tier 3: Returns the findings list; the caller decides the exit code.
 */
async function audit(client: Client, appRole: string, declared: Map<string, TargetSchema | undefined>): Promise<Finding[]> {
  const findings: Finding[] = [];
  const q = async <T>(sql: string, params: unknown[] = []): Promise<T[]> => (await client.query(sql, params)).rows as T[];

  await client.query('BEGIN READ ONLY');
  try {
    // 1. Nothing left behind in public.
    const leftovers = await q<{ kind: string; name: string }>(
      `SELECT 'table' AS kind, tablename AS name FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
       UNION ALL
       SELECT 'enum', t.typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typtype = 'e'`
    );
    for (const l of leftovers) findings.push({ check: 'public-leftover', detail: `${l.kind} public."${l.name}" was never moved` });

    // 2. Placement matches @@schema.
    const live = await q<{ schemaname: string; tablename: string }>(
      `SELECT schemaname, tablename FROM pg_tables WHERE schemaname IN ('app', 'admin')`
    );
    const liveByName = new Map(live.map((t) => [t.tablename, t.schemaname]));
    for (const [model, schema] of declared) {
      if (!schema) findings.push({ check: 'missing-@@schema', detail: `model ${model} has no @@schema in schema.prisma` });
      else if (!liveByName.has(model)) findings.push({ check: 'missing-table', detail: `${schema}."${model}" does not exist` });
      else if (liveByName.get(model) !== schema) findings.push({ check: 'wrong-schema', detail: `"${model}" is in ${liveByName.get(model)}, declared ${schema}` });
    }
    for (const t of live) {
      if (!declared.has(t.tablename)) findings.push({ check: 'undeclared-table', detail: `${t.schemaname}."${t.tablename}" has no Prisma model` });
    }

    // 3. Role access.
    const [{ exists }] = await q<{ exists: boolean }>('SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS exists', [appRole]);
    if (!exists) {
      console.log(`ℹ️  Role "${appRole}" not found - skipping role access checks (expected for local single-role Docker).`);
      return findings;
    }

    const [usage] = await q<{ app: boolean; admin: boolean }>(
      `SELECT has_schema_privilege($1, 'app', 'USAGE') AS app, has_schema_privilege($1, 'admin', 'USAGE') AS admin`,
      [appRole]
    );
    if (!usage.app) findings.push({ check: 'app-usage', detail: `${appRole} lacks USAGE on schema app` });
    if (usage.admin) findings.push({ check: 'admin-usage', detail: `${appRole} has USAGE on schema admin` });

    const privileges = await q<{ schemaname: string; tablename: string; sel: boolean; anyPriv: boolean }>(
      `SELECT schemaname, tablename,
              has_table_privilege($1, format('%I.%I', schemaname, tablename), 'SELECT') AS sel,
              has_table_privilege($1, format('%I.%I', schemaname, tablename), 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS "anyPriv"
         FROM pg_tables WHERE schemaname IN ('app', 'admin')`,
      [appRole]
    );
    for (const p of privileges) {
      if (p.schemaname === 'admin' && p.anyPriv) findings.push({ check: 'admin-grant', detail: `${appRole} holds privileges on admin."${p.tablename}"` });
      if (p.schemaname === 'app' && !p.sel) findings.push({ check: 'app-grant', detail: `${appRole} cannot SELECT app."${p.tablename}"` });
    }

    const defaults = await q<{ acl: string }>(
      `SELECT defaclacl::text AS acl FROM pg_default_acl d JOIN pg_namespace n ON n.oid = d.defaclnamespace
        WHERE n.nspname = 'app' AND d.defaclobjtype = 'r'`
    );
    if (!defaults.some((d) => d.acl.includes(`${appRole}=arwd`))) {
      findings.push({ check: 'default-privileges', detail: `no default privileges grant future app tables to ${appRole}` });
    }
    return findings;
  } finally {
    await client.query('ROLLBACK');
  }
}

/**
 * Entry point: resolves the connection, runs the audit and sets the exit code.
 *
 * Tier 1: Prints a pass/fail report.
 * Tier 2: A non-zero exit lets the deployment checklist (or CI) block on drift.
 * Tier 3: Connection strings are never printed.
 */
async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_ADMIN_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Set DATABASE_ADMIN_URL, DIRECT_URL or DATABASE_URL.');
  const appRole = process.env.APP_DB_ROLE || 'kovert_app';
  const declared = readDeclaredSchemas(path.join(__dirname, '../prisma/schema.prisma'));

  const client = new Client({ connectionString });
  await client.connect();
  try {
    const findings = await audit(client, appRole, declared);
    if (findings.length === 0) {
      console.log(`✅ Schema separation verified: ${declared.size} models placed correctly, ${appRole} access matches app/admin boundaries.`);
      return;
    }
    console.error(`❌ ${findings.length} schema separation finding(s):`);
    for (const f of findings) console.error(`   [${f.check}] ${f.detail}`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((err: Error) => {
  console.error('❌ Schema separation audit failed:', err.message.replace(/postgres(ql)?:\/\/\S+/g, '<redacted-url>'));
  process.exit(1);
});
