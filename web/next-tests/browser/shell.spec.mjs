// Deterministic demo browser coverage; not real-Quay end-to-end evidence.
import {test, expect} from '@playwright/test';

const base = '/__quay_next_preview__/';

for (const width of [320, 360, 768, 1024, 1280, 1440, 1536]) {
  test(`shell preserves navigation and fits at ${width}px`, async ({page, browserName}) => {
    await page.setViewportSize({width, height: 900});
    await page.goto(`${base}repository/acme/payments`);
    await expect(page.getByRole('heading', {level: 1, name: 'payments'})).toBeVisible();
    const mobile = width <= 1024;
    const navigationTrigger = page.getByRole('button', {name: 'Open navigation', exact: true});
    const dialog = page.getByRole('dialog', {name: 'Registry navigation', exact: true});
    const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
    if (mobile) {
      await expect(page.getByRole('navigation', {name: 'Workspace', exact: true})).toHaveCount(0);
      // Reach and open the mobile navigation through the keyboard too.
      for (let step = 0; step < 12 && !(await navigationTrigger.evaluate(el => el === document.activeElement)); step++) {
        await page.keyboard.press(tab);
      }
      await expect(navigationTrigger).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(dialog).toBeVisible();
    }
    const repositories = page.getByRole('navigation', {name: 'Workspace', exact: true})
      .getByRole('link', {name: 'Repositories', exact: true});
    await expect(repositories).toBeVisible();
    await expect(repositories).not.toHaveAttribute('aria-current', 'page');
    // Reach navigation through actual keyboard order, not programmatic focus.
    for (let step = 0; step < 12 && !(await repositories.evaluate(el => el === document.activeElement)); step++) {
      await page.keyboard.press(tab);
    }
    await expect(repositories).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', {level: 1, name: 'Repositories', exact: true})).toBeVisible();
    await expect(page.getByRole('searchbox')).toHaveCount(1);
    if (mobile) {
      await expect(dialog).toHaveCount(0);
      await expect(navigationTrigger).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(dialog).toBeVisible();
    }
    await expect(repositories).toHaveAttribute('aria-current', 'page');
    await expect(page.getByLabel('Namespace', {exact: true})).toBeVisible();
    await expect(page.getByLabel('Namespace', {exact: true})).toHaveCount(1);
    if (mobile) {
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(navigationTrigger).toBeFocused();
    }
    const environment = page.getByText('Demo data · no registry connection', {exact: true});
    await expect(environment).toBeVisible();
    for (const theme of ['light', 'dark']) {
      await page.getByRole('button', {name: /Theme: .* Change theme/}).click();
      await expect(page.getByRole('button', {name: `Theme: ${theme}. Change theme`})).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(await environment.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
  });
}

test('long repository paths wrap without clipping on a narrow page', async ({page}) => {
  await page.setViewportSize({width: 320, height: 900});
  const repository = 'very-long-repository-segment/'.repeat(8) + 'image';
  await page.goto(`${base}repository/acme/${repository}`);
  const heading = page.getByRole('heading', {level: 1, name: repository, exact: true});
  await expect(heading).toBeVisible();
  expect(await heading.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
