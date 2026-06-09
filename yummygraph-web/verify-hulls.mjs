// Verify folder/module boundaries: load a repo, turn folder boundaries on, and
// screenshot the smooth hulls in every layout (Force / Tree / Circles), then
// once more under the Light theme to confirm the labels stay legible.
//
// Hulls now work in all three layouts and the toggle persists across reloads.
// Point at the dev server to exercise local source: `URL=http://localhost:5173 node verify-hulls.mjs`
// (defaults to the production server on :4747).
import { chromium } from '@playwright/test';

const URL = process.env.URL ?? 'http://localhost:4747';
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });

const connect = async () => {
  const card = page.locator('[data-testid="landing-repo-card"]').first();
  try {
    await card.waitFor({ state: 'visible', timeout: 20_000 });
    await card.click();
  } catch {
    /* auto-connected */
  }
  await page.locator('[data-testid="status-ready"]').waitFor({ state: 'visible', timeout: 60_000 });
};

const tabs = { force: 0, tree: 1, circles: 2 };

try {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await connect();
  console.log('graph ready');

  // Turn folder boundaries on (no longer forces a layout switch).
  await page.locator('[data-testid="folder-hulls-toggle"]').click();
  console.log('folder boundaries on');

  for (const [name, idx] of Object.entries(tabs)) {
    await page.locator('[role="tab"]').nth(idx).click();
    await page.waitForTimeout(name === 'force' ? 6000 : 2500); // force layout settles slower
    await page.screenshot({ path: `/tmp/folder-hulls-${name}.png` });
    console.log(`screenshot → /tmp/folder-hulls-${name}.png`);
  }

  // Light theme — the toggle persists, so hulls are still on after reload.
  await page.evaluate(() => localStorage.setItem('yummygraph:theme', 'light'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await connect();
  await page.locator('[role="tab"]').nth(tabs.force).click();
  await page.waitForTimeout(6000);
  await page.screenshot({ path: '/tmp/folder-hulls-light.png' });
  console.log('screenshot → /tmp/folder-hulls-light.png');
} catch (err) {
  console.error('FAILED:', err.message);
  await page.screenshot({ path: '/tmp/folder-hulls-failure.png' }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
