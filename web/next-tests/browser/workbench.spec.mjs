// Deterministic HTTP contract suite, NOT real-Quay end-to-end evidence.
import { test, expect } from '@playwright/test';
import { startDemo } from '../../tools/next/demo.mjs';
import { hashes } from '../../tools/next/fixtures.mjs';
const base = '/__quay_next_preview__/';
const repo = `${base}repository/acme/payments`;
async function inspect(page) { await page.goto(repo); await page.getByRole('link', { name: 'v2.8.1', exact: true }).click(); await expect(page.getByTestId('artifact-full-digest')).toHaveText(hashes.index); }
test('workbench is explicit demo data and has no security request fan-out', async ({ page }) => {
    const scans = [];
    page.on('request', r => { if (r.url().includes('/security?'))
        scans.push(r.url()); });
    await page.goto(base);
    await expect(page.getByText('Demo data · no registry connection')).toBeVisible();
    await expect(page.getByRole('table', { name: 'Repositories', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'payments', exact: true })).toBeVisible();
    expect(scans).toEqual([]);
});
test('filtering is explicitly response-page scoped', async ({ page }) => { await page.goto(base); await page.getByLabel('Filter this response page').fill('payments'); await expect(page.getByRole('link', { name: 'payments', exact: true })).toBeVisible(); await expect(page.getByText('1 shown · 25 repositories in this response')).toBeVisible(); });
test('tag API uses one-based pagination and server exact-tag search', async ({ page }) => { await page.goto(repo); await expect(page.getByText('Page 1 · 25 tags returned')).toBeVisible(); await page.getByRole('button', { name: 'Next', exact: true }).click(); await expect(page.getByText('Page 2 · 25 tags returned')).toBeVisible(); await page.getByLabel('Find an exact tag').fill('v2.7.20'); await page.getByRole('button', { name: 'Find tag', exact: true }).click(); await expect(page.getByRole('link', { name: 'v2.7.20', exact: true })).toBeVisible(); await expect(page.getByText('Page 1 · 1 tags returned')).toBeVisible(); });
test('wide inspector is complementary, not a modal dialog', async ({ page }) => { await inspect(page); await expect(page.getByRole('complementary', { name: /Artifact details/ })).toBeVisible(); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByRole('table', { name: 'Tags and artifacts' })).toBeVisible(); await page.getByRole('button', { name: 'Close inspector' }).click(); await expect(page.getByRole('link', { name: 'v2.8.1', exact: true })).toBeFocused(); });
test('narrow inspection is a detail page and does not overflow', async ({ page }) => { await page.setViewportSize({ width: 360, height: 800 }); await inspect(page); await expect(page.getByRole('complementary')).toHaveCount(0); await expect(page.getByRole('heading', { level: 1, name: /Artifact details/ })).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); await page.getByRole('button', { name: 'Back to tags' }).click(); await expect(page.getByRole('link', { name: 'v2.8.1', exact: true })).toBeVisible(); });
test('deep-link close stays inside the application', async ({ page }) => { await page.goto(`${repo}?artifact=${encodeURIComponent(hashes.index)}&detail=page`); await expect(page.getByTestId('artifact-full-digest')).toHaveText(hashes.index); await page.getByRole('button', { name: 'Back to tags' }).click(); await expect(page).toHaveURL(/\/repository\/acme\/payments$/); });
test('inspection follows Back and Forward and survives a breakpoint change', async ({ page }) => {
    await inspect(page);
    await expect(page.getByRole('complementary', { name: /Artifact details/ })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('complementary')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'v2.8.1', exact: true })).toBeFocused();
    await page.goForward();
    await expect(page.getByTestId('artifact-full-digest')).toHaveText(hashes.index);
    await page.setViewportSize({ width: 360, height: 800 });
    await expect(page.getByRole('heading', { level: 1, name: /Artifact details/ })).toBeFocused();
    await expect(page.getByRole('complementary')).toHaveCount(0);
    await page.setViewportSize({ width: 1536, height: 960 });
    await expect(page.getByRole('complementary', { name: /Artifact details/ })).toBeVisible();
    await expect(page.getByTestId('artifact-full-digest')).toHaveText(hashes.index);
});
test('changing an exact-tag filter clears inspection without stale detail', async ({ page }) => {
    await inspect(page);
    await page.getByLabel('Find an exact tag').fill('v2.7.20');
    await page.getByRole('button', { name: 'Find tag', exact: true }).click();
    await expect(page.getByRole('link', { name: 'v2.7.20', exact: true })).toBeVisible();
    await expect(page.getByRole('complementary')).toHaveCount(0);
    await expect(page).not.toHaveURL(/artifact=/);
});
test('clipboard failure preserves a selectable full command and announces the error', async ({ page }) => {
    await inspect(page);
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Clipboard denied'); } } }));
    await page.getByRole('button', { name: 'Copy immutable pull command' }).click();
    await expect(page.getByRole('alert')).toHaveText('Clipboard access failed. Select and copy the complete command shown above.');
    await expect(page.getByTestId('artifact-immutable-command')).toHaveText(`podman pull registry.example.test/acme/payments@${hashes.index}`);
});
test('a missing sparse child cannot be copied as available', async ({ page }) => { await inspect(page); await page.getByLabel('Index or platform').selectOption(hashes.arm); await expect(page.getByText('This child is advertised but its content is not available here.')).toBeVisible(); await expect(page.getByRole('button', { name: 'Copy immutable pull command' })).toBeDisabled(); });
test('evidence is per digest and requested explicitly', async ({ page }) => { const requests = []; page.on('request', r => { if (r.url().includes('/security?'))
    requests.push(r.url()); }); await inspect(page); expect(requests).toHaveLength(0); await page.getByLabel('Index or platform').selectOption(hashes.amd); await page.getByRole('button', { name: 'Load report for this digest' }).click(); await expect(page.getByText(/1 high · 1 package findings/)).toBeVisible(); expect(requests).toHaveLength(1); await expect(page.getByText(/Cryptographic verification is not available/)).toBeVisible(); });
test('actual clipboard contains the full immutable reference', async ({ page, context, browserName }) => { test.skip(browserName !== 'chromium', 'Clipboard read permission integration is tested with Chromium.'); await context.grantPermissions(['clipboard-read', 'clipboard-write']); await inspect(page); await page.getByRole('button', { name: 'Copy immutable pull command' }).click(); await expect(page.getByRole('status').filter({ hasText: 'Copied the immutable' })).toBeVisible(); expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`podman pull registry.example.test/acme/payments@${hashes.index}`); });
test('unknown digest never reaches the API', async ({ page }) => { const manifests = []; page.on('request', r => { if (r.url().includes('/manifest/'))
    manifests.push(r.url()); }); await page.goto(`${repo}?artifact=sha256:bad`); await expect(page.getByText('Unsupported or invalid artifact digest')).toBeVisible(); expect(manifests).toHaveLength(0); });
test('dark theme uses the PatternFly theme class', async ({ page }) => { await page.goto(base); await page.getByRole('button', { name: /Theme: system/ }).click(); await page.getByRole('button', { name: /Theme: light/ }).click(); await expect(page.locator('html')).toHaveClass(/pf-v6-theme-dark/); });
test('empty repository is distinct from failure', async ({ page }) => { await page.goto(`${base}repository/acme/empty`); await expect(page.getByRole('heading', { name: 'No active tags' })).toBeVisible(); });
test('hostile repository metadata remains inert text', async ({ page }) => { const app = await startDemo({ port: 0, scenario: 'hostile' }); try {
    await page.goto(`${app.origin}${repo}`);
    await expect(page.getByText('<img src=x onerror="window.pwned=true">', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.pwned)).toBeUndefined();
    await page.getByRole('link', { name: 'v2.8.1', exact: true }).click();
    await page.getByText('Metadata and raw manifest', { exact: true }).click();
    await expect(page.getByText('<script>window.pwned=true</script>', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.pwned)).toBeUndefined();
}
finally {
    await app.close();
} });
test('backend failure is not an empty list', async ({ page }) => { const app = await startDemo({ port: 0, scenario: 'unavailable' }); try {
    await page.goto(app.origin + base);
    await expect(page.getByText('Request could not be completed')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No repositories returned' })).toHaveCount(0);
}
finally {
    await app.close();
} });
