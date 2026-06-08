// One-off Playwright driver: load 212ecom-be in the web UI, open the blast
// radius for a hub symbol, and screenshot it. Run with the production server
// on :4747 (which serves both the SPA and the API at the same origin).
import { chromium } from '@playwright/test';

const URL = process.env.URL ?? 'http://localhost:4747/?blast=findByPhoneNumber';
const SYMBOL = process.env.SYMBOL ?? 'findByPhoneNumber';
const OUT = process.env.OUT ?? '/tmp/blast-radius.png';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
page.on('console', (m) => {
  if (m.type() === 'error') console.log('  [browser error]', m.text().slice(0, 200));
});

try {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });

  // Pick the repo from the landing screen (single indexed repo here).
  const card = page.locator('[data-testid="landing-repo-card"]').first();
  try {
    await card.waitFor({ state: 'visible', timeout: 20_000 });
    await card.click();
    console.log('clicked landing repo card');
  } catch {
    console.log('no landing card (maybe auto-connected) — continuing');
  }

  // Wait for the graph to finish loading.
  await page.locator('[data-testid="status-ready"]').waitFor({ state: 'visible', timeout: 60_000 });
  console.log('graph ready');

  // Trigger the blast radius via the exposed hook (robust vs. URL rewrites),
  // retrying until the in-memory graph is populated.
  await page.waitForFunction(
    (name) => typeof window.__ygBlast === 'function' && window.__ygBlast(name) === true,
    SYMBOL,
    { timeout: 30_000, polling: 500 },
  );
  console.log('blast radius triggered for', SYMBOL);

  // Wait for the summary panel to render its headline number.
  await page.getByText('Blast Radius', { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
  // Let the camera focus + heat colours settle.
  await page.waitForTimeout(5000);

  await page.screenshot({ path: OUT, fullPage: false });
  console.log('screenshot saved →', OUT);
} catch (err) {
  console.error('FAILED:', err.message);
  await page.screenshot({ path: '/tmp/blast-radius-failure.png' }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
