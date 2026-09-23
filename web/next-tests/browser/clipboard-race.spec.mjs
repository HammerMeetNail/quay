// Deterministic demo browser coverage; not real-Quay end-to-end evidence.
import {test, expect} from '@playwright/test';
import {hashes} from '../../tools/next/fixtures.mjs';

const repo = '/__quay_next_preview__/repository/acme/payments';
const copyButton = page => page.getByRole('button', {name: 'Copy immutable pull command'});
const feedback = page => page.locator('.qn-inspector [aria-live="polite"]');

async function inspect(page) {
  await page.goto(repo);
  await page.getByRole('link', {name: 'v2.8.1', exact: true}).click();
  await expect(copyButton(page)).toBeEnabled();
  await page.evaluate(() => {
    window.clipboardWrites = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {writeText: text => new Promise((resolve, reject) => {
        window.clipboardWrites.push({text, resolve, reject});
      })},
    });
  });
}

async function settle(page, index, outcome) {
  await page.evaluate(async ({index, outcome}) => {
    const write = window.clipboardWrites[index];
    if (outcome === 'resolve') write.resolve();
    else write.reject(new Error('Clipboard denied'));
    // Flush the awaiting handler and a render turn before checking absence of feedback.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, {index, outcome});
}

for (const change of ['tool', 'target', 'hash', 'close']) {
  for (const outcome of ['resolve', 'reject']) {
    test(`stale clipboard ${outcome} is ignored after ${change} changes`, async ({page}) => {
      await inspect(page);
      await copyButton(page).click();
      expect(await page.evaluate(() => window.clipboardWrites[0].text))
        .toBe(`podman pull registry.example.test/acme/payments@${hashes.index}`);
      if (change === 'tool') {
        await page.getByLabel('Container tool').selectOption('docker');
        // Returning to the original command must not revive the old request.
        await page.getByLabel('Container tool').selectOption('podman');
      } else if (change === 'target') {
        await page.getByLabel('Index or platform').selectOption(hashes.amd);
        await expect(copyButton(page)).toBeEnabled();
      } else if (change === 'hash') {
        await page.getByRole('link', {name: 'v2.7.56', exact: true}).click();
        await expect(page.getByTestId('artifact-full-digest')).toHaveText(hashes.single);
        await expect(copyButton(page)).toBeEnabled();
      } else {
        await page.getByRole('button', {name: 'Close inspector'}).click();
        await page.getByRole('link', {name: 'v2.8.1', exact: true}).click();
        await expect(copyButton(page)).toBeEnabled();
      }
      await settle(page, 0, outcome);
      await expect(feedback(page)).toBeEmpty();
      await copyButton(page).click();
      await settle(page, 1, 'resolve');
      await expect(feedback(page)).toContainText('Copied the immutable pull command');
    });
  }
}

test('only the latest clipboard request can announce its result', async ({page}) => {
  await inspect(page);
  await copyButton(page).click();
  await copyButton(page).click();
  await settle(page, 1, 'reject');
  await expect(feedback(page)).toHaveText('Clipboard access failed. Select and copy the complete command shown above.');
  await settle(page, 0, 'resolve');
  await expect(feedback(page)).toHaveAttribute('role', 'alert');
  await expect(feedback(page)).toHaveText('Clipboard access failed. Select and copy the complete command shown above.');
  await expect(page.getByTestId('artifact-immutable-command'))
    .toHaveText(`podman pull registry.example.test/acme/payments@${hashes.index}`);
});
