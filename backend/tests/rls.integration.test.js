import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * The two-account privacy proof, run against a real Neon project.
 *
 * This talks to the public Data API directly — deliberately bypassing our own
 * Express API — because the claim being tested is that *Postgres* protects the
 * rows, not that our server remembers to filter them. If RLS were misconfigured
 * these assertions would fail even though the app UI looked fine.
 *
 * Opt-in: create backend/tests/.env.test (gitignored) and run `npm run test:rls`.
 *
 *   NEON_DATA_API_URL=https://ep-xxx.us-east-1.aws.neon.tech/neondb/rest/v1
 *   NEON_AUTH_BASE_URL=https://ep-xxx.neonauth.us-east-1.aws.neon.tech/neondb/auth
 *   USER_A_EMAIL=test-a@example.com
 *   USER_A_PASSWORD=...
 *   USER_B_EMAIL=test-b@example.com
 *   USER_B_PASSWORD=...
 *   # Or, instead of the email/password pairs, paste tokens straight from the
 *   # browser (Application -> session) as USER_A_TOKEN / USER_B_TOKEN.
 */

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, '.env.test');

const loadEnvFile = () => {
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return out;
};

const env = { ...loadEnvFile(), ...process.env };
const configured = Boolean(
  env.NEON_DATA_API_URL && (env.USER_A_TOKEN || (env.USER_A_EMAIL && env.USER_A_PASSWORD))
);

const strip = (u) => String(u).replace(/\/+$/, '');

/**
 * Sign in with Better Auth and return a JWT usable against the Data API.
 *
 * Neon rejects auth calls without an Origin header, and that origin has to be
 * one of the project's trusted origins — the same rule the browser is subject
 * to. ORIGIN defaults to the local dev server.
 */
const ORIGIN = env.TEST_ORIGIN || 'http://localhost:5173';

const signIn = async (email, password) => {
  const authUrl = strip(env.NEON_AUTH_BASE_URL);
  const res = await fetch(`${authUrl}/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Sign-in failed for ${email}: ${res.status} ${await res.text()}`);

  // Sign-in returns an opaque session token plus a session cookie; the JWT the
  // Data API wants is minted from that cookie at /token.
  const cookie = res.headers.get('set-cookie');
  const tokenRes = await fetch(`${authUrl}/token`, {
    headers: { Origin: ORIGIN, ...(cookie ? { cookie } : {}) },
  });
  if (!tokenRes.ok) throw new Error(`Token exchange failed for ${email}: ${tokenRes.status}`);
  const tokenBody = await tokenRes.json();
  const token = tokenBody.token ?? tokenBody.access_token;
  if (!token) throw new Error(`No JWT returned for ${email}`);
  return token;
};

/** A raw Data API call as a given user. */
const asUser = (token) => async (path, init = {}) => {
  const res = await fetch(`${strip(env.NEON_DATA_API_URL)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

describe.skipIf(!configured)('Row Level Security — user A cannot reach user B\'s contacts', () => {
  let a, b, bContactId, aContactId;

  beforeAll(async () => {
    const tokenA = env.USER_A_TOKEN || (await signIn(env.USER_A_EMAIL, env.USER_A_PASSWORD));
    const tokenB = env.USER_B_TOKEN || (await signIn(env.USER_B_EMAIL, env.USER_B_PASSWORD));
    a = asUser(tokenA);
    b = asUser(tokenB);

    const madeByB = await b('/contacts?select=*', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ name: `B private ${Date.now()}`, priority: 'high' }),
    });
    expect(madeByB.status).toBe(201);
    bContactId = madeByB.body[0].id;

    const madeByA = await a('/contacts?select=*', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ name: `A private ${Date.now()}`, priority: 'low' }),
    });
    expect(madeByA.status).toBe(201);
    aContactId = madeByA.body[0].id;
  }, 30_000);

  it("stamps each row with its creator via the auth.user_id() default", async () => {
    const mine = await a('/contacts?select=user_id');
    const owners = new Set(mine.body.map((row) => row.user_id));
    expect(owners.size).toBe(1);
  });

  it("A's full listing never contains B's contact", async () => {
    const all = await a('/contacts?select=id');
    const ids = all.body.map((row) => row.id);
    expect(ids).toContain(aContactId);
    expect(ids).not.toContain(bContactId);
  });

  it("A cannot read B's contact even when asking for it by id", async () => {
    const res = await a(`/contacts?id=eq.${bContactId}&select=*`);
    expect(res.body).toEqual([]);
  });

  it("A cannot update B's contact", async () => {
    const res = await a(`/contacts?id=eq.${bContactId}&select=*`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ name: 'Hijacked by A' }),
    });
    expect(res.body).toEqual([]);

    // ...and B's row is untouched.
    const check = await b(`/contacts?id=eq.${bContactId}&select=name`);
    expect(check.body[0].name).not.toBe('Hijacked by A');
  });

  it("A cannot delete B's contact", async () => {
    const res = await a(`/contacts?id=eq.${bContactId}&select=*`, {
      method: 'DELETE',
      headers: { Prefer: 'return=representation' },
    });
    expect(res.body).toEqual([]);

    const check = await b(`/contacts?id=eq.${bContactId}&select=id`);
    expect(check.body).toHaveLength(1);
  });

  it('A cannot hand one of their own rows to B (the UPDATE WITH CHECK clause)', async () => {
    const bOwner = (await b('/contacts?select=user_id&limit=1')).body[0].user_id;
    const res = await a(`/contacts?id=eq.${aContactId}&select=*`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: bOwner }),
    });
    // Either the policy rejects it outright, or the trigger pins user_id back.
    if (res.status === 200 && res.body.length) {
      expect(res.body[0].user_id).not.toBe(bOwner);
    } else {
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  });

  it('an unauthenticated caller gets nothing at all', async () => {
    const res = await fetch(`${strip(env.NEON_DATA_API_URL)}/contacts?select=*`);
    expect(res.ok).toBe(false);
  });
});

describe.skipIf(configured)('Row Level Security (skipped)', () => {
  it('needs backend/tests/.env.test — see the header of this file', () => {
    expect(true).toBe(true);
  });
});
