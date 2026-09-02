/**
 * Applies db/schema.sql using DATABASE_URL.
 *
 * This is the ONLY thing in the project that touches a raw Postgres
 * connection, it is run by hand, and it never ships to the browser. If you
 * prefer not to put DATABASE_URL on disk at all, paste db/schema.sql into the
 * Neon Console SQL Editor instead — the result is identical.
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(here, '..', '..', 'db', 'schema.sql');

const run = async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(
      'DATABASE_URL is not set.\n' +
        'Set it in backend/.env, or paste db/schema.sql into the Neon SQL Editor instead.'
    );
    process.exit(1);
  }

  const sql = await readFile(schemaPath, 'utf8');
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(sql);
    console.log('Schema applied: contacts table, constraints, RLS policies and grants.');

    const { rows: policies } = await client.query(
      "select policyname, cmd from pg_policies where tablename = 'contacts' order by cmd"
    );
    console.log(`RLS policies present (${policies.length}):`);
    for (const p of policies) console.log(`  ${p.cmd.padEnd(6)} ${p.policyname}`);
  } finally {
    await client.end();
  }
};

run().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exit(1);
});
