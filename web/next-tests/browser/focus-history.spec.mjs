// Deterministic demo browser coverage; not real-Quay end-to-end evidence.
import {test, expect} from '@playwright/test';
import {hashes} from '../../tools/next/fixtures.mjs';

const repo = '/__quay_next_preview__/repository/acme/payments';

for (const width of [360, 1536]) {
  test(`Back, Forward, and Close restore collection focus at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 960});
    await page.goto(repo);
    const opener = page.getByRole('link', {name: 'v2.8.1', exact: true});
    const heading = page.getByRole('heading', {level: 1, name: 'payments', exact: true});
    await opener.click();
    await expect(page.getByTestId('artifact-full-digest')).toHaveText(hashes.index);

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${repo}$`));
    await expect(opener).toBeFocused();
    await page.goForward();
    await expect(page.getByTestId('artifact-full-digest')).toHaveText(hashes.index);
    const close = page.getByRole('button', {name: width === 360 ? 'Back to tags' : 'Close inspector', exact: true});
    // Ensure the control being removed owns focus, including in WebKit where
    // clicking a button does not necessarily focus it.
    await close.focus();
    await expect(close).toBeFocused();
    await close.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${repo}$`));
    await expect(page.getByTestId('artifact-full-digest')).toHaveCount(0);
    await expect(heading).toBeFocused();
  });
}

test('direct detail Close stays in the app and focuses the collection heading', async ({page}) => {
  await page.goto(`${repo}?artifact=${encodeURIComponent(hashes.index)}&detail=page`);
  const close = page.getByRole('button', {name: 'Back to tags', exact: true});
  await expect(page.getByTestId('artifact-full-digest')).toHaveText(hashes.index);
  await close.focus();
  await close.press('Enter');
  await expect(page).toHaveURL(new RegExp(`${repo}$`));
  await expect(page.getByRole('heading', {level: 1, name: 'payments', exact: true})).toBeFocused();
});
