// Deterministic HTTP contract suite, NOT real-Quay end-to-end evidence.
import { test, expect } from '@playwright/test';
import { fixtureResponse } from '../../tools/next/fixtures.mjs';

const base = '/__quay_next_preview__/';
const first = `${base}?q=service&keep=exact%2Bvalue`;
const a = 'opaque:A+/=';
const b = 'opaque:B+/=';
const pageUrl = cursor => `${first}&cursor=${encodeURIComponent(cursor)}`;
const loopMessage = 'The registry repeated a pagination cursor. Pagination stopped to avoid a loop.';
// React Router canonicalizes the basename without a trailing slash on client navigation.
// Compare every encoded query byte while treating those two equivalent base paths alike.
async function expectUrl(page, expected) {
    const normalized = raw => { const url = new URL(raw, 'http://127.0.0.1'); return `${url.pathname.replace(/\/$/, '')}${url.search}`; };
    await expect.poll(() => normalized(page.url())).toBe(normalized(expected));
}

async function installPages(page) {
    await page.route('**/api/v1/repository?*', async route => {
        const url = new URL(route.request().url());
        const cursor = url.searchParams.get('next_page');
        expect([null, a, b]).toContain(cursor);
        url.searchParams.set('next_page', `offset:${cursor === a ? 15 : cursor === b ? 30 : 0}`);
        const [status, body] = fixtureResponse(url);
        await route.fulfill({ status, json: { ...body, next_page: cursor === null ? a : cursor === a ? b : a } });
    });
}

async function next(page, cursor) {
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expectUrl(page, pageUrl(cursor));
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
    await expect(page.getByText(loopMessage)).toHaveCount(0);
}

test('repository cursor ancestry follows browser history and preserves URL parameters', async ({ page }) => {
    await installPages(page);
    await page.goto(first);
    await next(page, a);
    await next(page, b);
    await page.goBack();
    await expectUrl(page, pageUrl(a));
    await page.goBack();
    await expectUrl(page, first);
    // Previously the stale button-only ancestry rejected A here.
    await next(page, a);
    await next(page, b);
    await page.goBack();
    await expectUrl(page, pageUrl(a));
    await page.goForward();
    await expectUrl(page, pageUrl(b));
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText(loopMessage)).toBeVisible();
    await expectUrl(page, pageUrl(b));
    await page.goBack();
    await expectUrl(page, pageUrl(a));
    await expect(page.getByText(loopMessage)).toHaveCount(0);
    // Replacing the current entry to change a filter must retain its ancestry.
    await page.getByLabel('Filter this response page').fill('service-');
    await page.getByRole('button', { name: 'Previous', exact: true }).click();
    await expectUrl(page, `${base}?q=service-&keep=exact%2Bvalue`);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expectUrl(page, `${base}?q=service-&keep=exact%2Bvalue&cursor=${encodeURIComponent(a)}`);
    await page.getByRole('button', { name: 'Return to first response page' }).click();
    await expectUrl(page, `${base}?q=service-&keep=exact%2Bvalue`);
});

test('a cursor deep link returns to the first page without inventing ancestry', async ({ page }) => {
    await installPages(page);
    await page.goto(pageUrl(b));
    await page.getByRole('button', { name: 'Previous', exact: true }).click();
    await expectUrl(page, first);
    await next(page, a);
});
