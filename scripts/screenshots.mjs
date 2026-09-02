/**
 * Captures the README's grading evidence from the running app.
 *
 * Requires both dev servers up (`npm run dev`) and two test accounts to exist.
 * Credentials come from backend/tests/.env.test so nothing is hard-coded here.
 *
 *   node scripts/screenshots.mjs
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'docs', 'screenshots');
mkdirSync(outDir, { recursive: true });

const APP = process.env.APP_URL || 'http://localhost:5173';

const env = (() => {
  const p = join(root, 'backend', 'tests', '.env.test');
  if (!existsSync(p)) throw new Error(`Missing ${p} — see the header of rls.integration.test.js`);
  const out = {};
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
})();

const DESKTOP = { width: 1440, height: 960 };
const MOBILE = { width: 390, height: 844 };

const shot = async (page, name) => {
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(outDir, `${name}.png`) });
  console.log(`  ✓ ${name}.png`);
};

/** Sign in through the real UI, exactly as a grader would. */
const signIn = async (page, email, password) => {
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /Enter the portal/ }).click();
  await page.waitForSelector('text=Signed in as', { timeout: 20000 });
};

const signOut = async (page) => {
  const button = page.getByRole('button', { name: /^Sign out$/ });
  if (!(await button.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'More options' }).click();
  }
  await button.click();
  await page.waitForSelector('text=Enter the portal', { timeout: 20000 });
};

const run = async () => {
  const browser = await chromium.launch();

  // ---- User A, desktop -----------------------------------------------------
  const a = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 2 });
  const page = await a.newPage();

  await page.goto(APP, { waitUntil: 'networkidle' });
  await shot(page, '01-sign-in');

  await signIn(page, env.USER_A_EMAIL, env.USER_A_PASSWORD);
  await page.waitForTimeout(2500); // let the confetti settle
  await shot(page, '02-contacts');

  // The add/edit dialog.
  await page.getByRole('button', { name: /Add contact/ }).click();
  await page.getByLabel('Name').fill('Jordan Ellis');
  await page.getByLabel('Company').fill('Cal Career Center');
  await page.getByLabel('Role').fill('Advisor');
  await page.getByLabel('Where you met').fill('Career fair, Pauley Ballroom');
  await shot(page, '03-form');

  // Invalid input, rejected by the server with the message inline.
  await page.getByLabel('Name').fill('   ');
  await page.getByRole('button', { name: /Add contact$/ }).click();
  await page.waitForTimeout(600);
  await shot(page, '04-invalid');
  await page.getByRole('button', { name: 'Cancel' }).click();

  // Sort and filter.
  await page.selectOption('#sort-by', 'priority');
  await page.getByRole('button', { name: 'High' }).click();
  await shot(page, '06-sort-filter');
  await page.getByRole('button', { name: 'All' }).click();

  // Data survives a full reload.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('text=Signed in as', { timeout: 20000 });
  await shot(page, '07-after-refresh');

  await signOut(page);
  await shot(page, '08-signed-out');

  // ---- User B: the privacy proof, side by side -----------------------------
  const b = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 2 });
  const pageB = await b.newPage();
  await signIn(pageB, env.USER_B_EMAIL, env.USER_B_PASSWORD);
  await pageB.waitForTimeout(2500);
  await shot(pageB, '05-two-accounts');

  // ---- Mobile --------------------------------------------------------------
  const m = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const pageM = await m.newPage();
  await signIn(pageM, env.USER_A_EMAIL, env.USER_A_PASSWORD);
  await pageM.waitForTimeout(2500);
  await shot(pageM, '09-mobile');

  await browser.close();
  console.log(`\nScreenshots written to ${outDir}`);
};

run().catch((error) => {
  console.error('Screenshot run failed:', error.message);
  process.exit(1);
});
