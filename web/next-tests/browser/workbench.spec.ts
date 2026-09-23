import {test, expect} from '@playwright/test';
import {PREFIX} from '../../tools/next/policy.mjs';
import {INDEX, AMD64} from '../../tools/next/fixtures.mjs';

// Contract UI tests against the real local HTTP fixture server, not Quay E2E.
// These tests intentionally remain outside web/playwright/e2e/.
test('shows fixture identity and repositories without scan fan-out', async ({page}) => {
  const scans: string[] = [];
  page.on('request', request => {if (request.url().includes('/security?')) scans.push(request.url());});
  await page.goto(PREFIX);
  await expect(page.getByRole('table', {name: 'Repositories'})).toBeVisible();
  await expect(page.getByText('Demo data · not quay.io')).toBeVisible();
  await expect(page.getByRole('link', {name: 'payments', exact: true})).toBeVisible();
  expect(scans).toHaveLength(0);
});
test('exact tag search follows backend page and filter contracts', async ({page}) => {
  await page.goto(`${PREFIX}repository/demo/payments`);
  await expect(page.getByRole('link', {name: 'v2.8.1', exact: true})).toBeVisible();
  await page.getByLabel('Search exact tag').fill('stable');
  await page.getByRole('button', {name: 'Search', exact: true}).click();
  await expect(page.getByRole('link', {name: 'stable', exact: true})).toBeVisible();
  await expect(page.getByRole('link', {name: 'v2.8.1', exact: true})).toHaveCount(0);
  await expect(page).toHaveURL(/q=stable/);
});
test('tag pagination does not silently fetch all pages', async ({page}) => {
  await page.goto(`${PREFIX}repository/demo/payments`);
  await expect(page.getByText('Page 1 · 25 tags loaded')).toBeVisible();
  await page.getByRole('button', {name: 'Next', exact: true}).click();
  await expect(page.getByText('Page 2 · 10 tags loaded')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Next', exact: true})).toBeDisabled();
  await page.goBack(); await expect(page.getByText('Page 1 · 25 tags loaded')).toBeVisible();
});
test('wide inspector is non-modal and copies the full immutable reference', async ({page, context}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({width: 1800, height: 1000});
  await page.goto(`${PREFIX}repository/demo/payments`);
  await page.getByRole('link', {name: 'v2.8.1', exact: true}).click();
  const inspector = page.getByRole('complementary', {name: 'Artifact details'});
  await expect(inspector).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('artifact-full-digest')).toHaveText(INDEX);
  await inspector.getByRole('button', {name: 'Copy immutable pull command'}).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`podman pull registry.example.test/demo/payments@${INDEX}`);
  await inspector.getByRole('button', {name: 'Close inspector'}).click();
  await expect(page.getByRole('link', {name: 'v2.8.1', exact: true})).toBeFocused();
});
test('platform target is reflected in the URL and scan requests are on demand', async ({page}) => {
  const scans: string[] = [];
  page.on('request', request => {if (request.url().includes('/security?')) scans.push(request.url());});
  await page.goto(`${PREFIX}repository/demo/payments?artifact=${encodeURIComponent(INDEX)}&selectedTag=v2.8.1`);
  await page.getByLabel('Pull target').selectOption(AMD64);
  await expect(page.getByTestId('artifact-immutable-command')).toContainText(AMD64);
  await expect(page).toHaveURL(/target=/);
  expect(scans).toHaveLength(0);
  await page.getByRole('button', {name: 'Load scan report'}).click();
  await expect(page.getByText('1 package/advisory findings reported')).toBeVisible();
  expect(scans).toHaveLength(1);
  await page.reload();
  await expect(page.getByLabel('Pull target')).toHaveValue(AMD64);
});
test('metadata remains text, not executable HTML', async ({page}) => {
  let dialogs = 0; page.on('dialog', dialog => {dialogs++; void dialog.dismiss();});
  await page.goto(`${PREFIX}repository/demo/payments?artifact=${encodeURIComponent(INDEX)}`);
  await page.getByRole('button', {name: 'Metadata and labels'}).click();
  await expect(page.getByText('<script>not executable</script>', {exact: true})).toBeVisible();
  expect(dialogs).toBe(0);
});
test('narrow detail is a page and returns to tags without losing the route', async ({page}) => {
  await page.setViewportSize({width: 360, height: 800});
  await page.goto(`${PREFIX}repository/demo/payments`);
  await page.getByRole('link', {name: 'v2.8.1', exact: true}).click();
  await expect(page.getByRole('complementary', {name: 'Artifact details'})).toHaveCount(0);
  await expect(page.getByRole('heading', {name: 'Artifact details: v2.8.1'})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', {name: 'Back to tags'}).click();
  await expect(page.getByRole('link', {name: 'v2.8.1', exact: true})).toBeVisible();
});
test('backend errors are not displayed as empty repositories', async ({page}) => {
  await page.goto(`${PREFIX}repository/demo/unavailable`);
  await expect(page.getByText('Registry request failed (503).').first()).toBeVisible();
  await expect(page.getByText('No active tags on this page.')).toHaveCount(0);
});
test('dark preference changes the PatternFly theme', async ({page}) => {
  await page.goto(PREFIX); await page.getByLabel('Theme', {exact: true}).selectOption('dark');
  await expect(page.locator('html')).toHaveClass(/pf-v6-theme-dark/);
  expect(await page.evaluate(() => Object.keys(localStorage).every(key => key === 'quay-next.theme'))).toBe(true);
});
