// Verify the node-kind filter presets: load 212ecom-be, capture the full graph,
// then click the "Code only" preset and capture again — the leaf/property nodes
// should disappear. Run against the production server on :4747.
import { chromium } from '@playwright/test';

const URL = process.env.URL ?? 'http://localhost:4747';
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });

try {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  const card = page.locator('[data-testid="landing-repo-card"]').first();
  try {
    await card.waitFor({ state: 'visible', timeout: 20_000 });
    await card.click();
  } catch {
    /* auto-connected */
  }
  await page.locator('[data-testid="status-ready"]').waitFor({ state: 'visible', timeout: 60_000 });
  await page.waitForTimeout(3500); // let initial layout settle
  await page.screenshot({ path: '/tmp/filters-before.png' });
  console.log('captured before (all node kinds)');

  // Open the Filters tab.
  await page.getByText('Filters', { exact: true }).first().click();
  // Apply the "Code only" preset.
  await page.getByRole('button', { name: 'Code only' }).click();
  console.log('clicked "Code only" preset');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/tmp/filters-after.png' });
  console.log('captured after (code only) → /tmp/filters-after.png');
} catch (err) {
  console.error('FAILED:', err.message);
  await page.screenshot({ path: '/tmp/filters-failure.png' }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
