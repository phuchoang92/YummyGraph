// Verify folder/module boundaries: load 212ecom-be, toggle folder boundaries
// (which switches to Force view and re-clusters symbols by folder), let the
// layout settle, and screenshot. Run against the production server on :4747.
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
  console.log('graph ready');

  // Toggle folder boundaries — auto-switches to Force view + re-clusters by folder.
  await page.locator('[data-testid="folder-hulls-toggle"]').click();
  console.log('folder boundaries on; letting the folder-clustered layout settle…');
  await page.waitForTimeout(6000); // force layout runs up to ~30s

  await page.screenshot({ path: '/tmp/folder-hulls.png' });
  console.log('screenshot saved → /tmp/folder-hulls.png');
} catch (err) {
  console.error('FAILED:', err.message);
  await page.screenshot({ path: '/tmp/folder-hulls-failure.png' }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
