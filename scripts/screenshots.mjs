/**
 * Captures the README's grading evidence from the running app.
 *
 * The CRUD sequence is deliberately one continuous story about a single
 * contact — created, reloaded, edited, deleted — so a grader can see that the
 * same record survived a refresh rather than taking it on trust. It cleans up
 * after itself and never touches any contact it did not create.
 *
 * Requires two test accounts to exist. Credentials come from
 * backend/tests/.env.test so nothing is hard-coded here.
 *
 *   node scripts/screenshots.mjs                        # against localhost
 *   APP_URL=https://…vercel.app node scripts/screenshots.mjs   # against prod
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

/** Toasts sit over the bottom-right controls; clear them before clicking there. */
const dismissToasts = async (page) => {
  const closers = page.getByRole('button', { name: 'Dismiss notification' });
  for (let i = await closers.count(); i > 0; i--) {
    await closers.first().click().catch(() => {});
  }
  await page.waitForTimeout(250);
};

const signIn = async (page, email, password) => {
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /Enter the portal/ }).click();
  await page.waitForSelector('text=Signed in as', { timeout: 20000 });
};

const openMenuIfCollapsed = async (page) => {
  const more = page.getByRole('button', { name: 'More options' });
  if (await more.isVisible().catch(() => false)) await more.click();
};

const run = async () => {
  const browser = await chromium.launch();

  const a = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 2 });
  const page = await a.newPage();

  // ---- Sign in -------------------------------------------------------------
  await page.goto(APP, { waitUntil: 'networkidle' });
  await shot(page, '01-sign-in');

  await signIn(page, env.USER_A_EMAIL, env.USER_A_PASSWORD);
  await page.waitForTimeout(2500); // let the sign-in confetti settle
  await shot(page, '02-contacts');

  // ---- CREATE --------------------------------------------------------------
  // A unique name so the refresh evidence is unambiguous.
  const marker = `Refresh Proof ${Date.now().toString().slice(-6)}`;
  await dismissToasts(page);
  await page.getByRole('button', { name: /Add contact/ }).click();
  await page.getByLabel('Name').fill(marker);
  await page.getByLabel('Company').fill('Berkeley Career Center');
  await page.getByLabel('Role').fill('Advisor');
  await page.getByLabel('Where you met').fill('Career fair, Pauley Ballroom');
  await page.selectOption('#c-priority', 'high');
  await page.getByLabel('Notes').fill('Created by the screenshot script to prove persistence.');
  await shot(page, '03-add-form');

  // ---- INVALID INPUT -------------------------------------------------------
  // Blank the name and submit: rejected, with the reason beside the field.
  await page.getByLabel('Name').fill('   ');
  await page.getByRole('button', { name: /Add contact$/ }).click();
  await page.waitForTimeout(700);
  await shot(page, '04-invalid');

  // Restore the name and actually save.
  await page.getByLabel('Name').fill(marker);
  await page.getByRole('button', { name: /Add contact$/ }).click();
  await page.waitForSelector(`text=${marker}`, { timeout: 20000 });
  await page.waitForTimeout(2200);
  await shot(page, '07-created');

  // ---- SURVIVES REFRESH ----------------------------------------------------
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('text=Signed in as', { timeout: 20000 });
  await page.waitForSelector(`text=${marker}`, { timeout: 20000 });
  await shot(page, '08-after-refresh');

  // ---- SORT AND FILTER -----------------------------------------------------
  await dismissToasts(page);
  await page.selectOption('#sort-by', 'priority');
  await page.getByRole('button', { name: 'High', exact: true }).click();
  await page.waitForTimeout(900);
  await shot(page, '06-sort-filter');
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.waitForTimeout(700);

  // ---- EDIT ----------------------------------------------------------------
  await page.getByRole('button', { name: `Edit ${marker}` }).first().click();
  await page.waitForTimeout(600);
  await page.getByLabel('Notes').fill('Edited in place — the dialog loads the existing values.');
  await page.selectOption('#c-priority', 'low');
  await shot(page, '09-edit');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.waitForTimeout(2000);

  // ---- DELETE --------------------------------------------------------------
  await dismissToasts(page);
  await page.getByRole('button', { name: `Delete ${marker}` }).first().click();
  await page.waitForTimeout(600);
  await shot(page, '10-delete-confirm');
  await page.getByRole('button', { name: 'Delete forever' }).click();
  await page.waitForTimeout(2200);
  await shot(page, '11-deleted');

  // ---- MAX TRIP ------------------------------------------------------------
  await dismissToasts(page);
  await openMenuIfCollapsed(page);
  await page
    .locator('button[title="Everything, all the way up"]')
    .locator('visible=true')
    .first()
    .click();
  await page.waitForTimeout(2600);
  await shot(page, '14-max-trip');
  await page.locator('#trip-intensity').fill('1.5');
  await page.waitForTimeout(900);

  // ---- SIGN OUT ------------------------------------------------------------
  await openMenuIfCollapsed(page);
  await page.getByRole('button', { name: /^Sign out$/ }).click();
  await page.waitForSelector('text=Enter the portal', { timeout: 20000 });
  await shot(page, '12-signed-out');

  // ---- User B: the privacy proof -------------------------------------------
  const b = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 2 });
  const pageB = await b.newPage();
  await signIn(pageB, env.USER_B_EMAIL, env.USER_B_PASSWORD);
  await pageB.waitForTimeout(2500);
  await shot(pageB, '05-two-accounts');

  // ---- Mobile --------------------------------------------------------------
  const m = await browser.newContext({
    viewport: MOBILE, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const pageM = await m.newPage();
  await signIn(pageM, env.USER_A_EMAIL, env.USER_A_PASSWORD);
  await pageM.waitForTimeout(2500);
  await shot(pageM, '13-mobile');

  await browser.close();
  console.log(`\nScreenshots written to ${outDir}`);
};

run().catch((error) => {
  console.error('Screenshot run failed:', error.message);
  process.exit(1);
});
