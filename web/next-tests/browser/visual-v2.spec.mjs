// Fixture-only browser acceptance for the v2 presentation. Not live Quay/auth evidence.
import {test, expect} from '@playwright/test';
const base = '/__quay_next_preview__/';
const repo = `${base}repository/acme/payments`;

test('visibility is embedded in identity and distinguishes public/private without color alone', async ({page}) => {
  await page.goto(base);
  const table = page.getByRole('table', {name: 'Repositories', exact: true});
  await expect(table).toBeVisible();
  await expect(table.getByRole('columnheader', {name: 'Visibility', exact: true})).toHaveCount(0);
  for (const label of ['Public', 'Private']) {
    const marker = table.getByTestId('visibility-mark').filter({hasText: label}).first();
    await expect(marker).toBeVisible(); await expect(marker.locator('svg')).toHaveCount(1);
  }
  await page.getByRole('group', {name: 'Visibility filters for this page'}).getByRole('button', {name: /^Private/}).click();
  await expect(table.getByTestId('visibility-mark').filter({hasText: 'Public'})).toHaveCount(0);
  await expect(page.getByText('Loaded page only', {exact: true})).toBeVisible();
});

test('sign-in help is an intentional modal, not a permanent workbench banner', async ({page}) => {
  await page.goto(base); await expect(page.getByRole('table', {name: 'Repositories', exact: true})).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', {name: 'Preview help', exact: true}).click();
  await expect(page.getByRole('dialog', {name: 'Preview controls & session'})).toBeVisible();
  await expect(page.getByText('Authentication stays on the genuine Quay site')).toBeVisible();
  await page.getByRole('button', {name: 'Done', exact: true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('repository preview preserves the table and restores its trigger', async ({page}) => {
  await page.goto(base);
  await expect(page.locator('.qn-brand-mark')).toHaveCSS('background-image', /quay-mark/);
  expect(await page.locator('.qn-brand-mark').evaluate(async (mark) => {
    const image = new Image();
    image.src = getComputedStyle(mark).backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1] ?? '';
    try { await image.decode(); return image.naturalWidth > 0; } catch { return false; }
  })).toBe(true);
  const trigger = page.getByRole('button', {name: 'Preview payments', exact: true});
  await trigger.click();
  await expect(page.getByRole('complementary', {name: /payments/})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Quick actions'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'About', exact: true})).toBeVisible();
  await expect(page.getByRole('table', {name: 'Repositories', exact: true})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Browse tags & artifacts'})).toBeVisible();
  await expect(page.getByText('Healthy', {exact: true})).toHaveCount(0);
  await page.getByRole('button', {name: 'Close repository preview', exact: true}).click();
  await expect(trigger).toBeFocused();
});

test('visible platform labels load without another click and deduplicate shared digests', async ({page}) => {
  const manifestRequests = [], securityRequests = [];
  page.on('request', request => {
    if (request.url().includes('/security?')) securityRequests.push(request.url());
    else if (request.url().includes('/manifest/')) manifestRequests.push(request.url());
  });
  await page.goto(repo);
  await expect(page.getByRole('table', {name: 'Tags and artifacts'})).toBeVisible();
  await expect(page.getByText('linux/amd64', {exact: true}).first()).toBeVisible();
  await expect(page.getByText('linux/arm64/v8', {exact: true}).first()).toBeVisible();
  const linuxPlatform = page.getByRole('list', {name: 'Advertised platforms'}).first()
    .getByRole('listitem').filter({hasText: 'linux/amd64'});
  await expect(linuxPlatform.locator('[data-platform-os="linux"] svg')).toBeVisible();
  await expect(linuxPlatform.locator('[data-platform-os="linux"]')).toHaveAttribute('aria-hidden', 'true');
  expect(manifestRequests).toHaveLength(1); // v2.8.1 and stable point to the same index in this fixture.
  expect(securityRequests).toHaveLength(0);
});

test('mobile navigation has one namespace control, closes with Escape, and returns focus', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844}); await page.goto(base);
  await expect(page.getByRole('list', {name: 'Repositories', exact: true})).toBeVisible();
  const trigger = page.getByRole('button', {name: 'Open navigation', exact: true});
  await trigger.click();
  const dialog = page.getByRole('dialog', {name: 'Registry navigation', exact: true});
  await expect(dialog).toBeVisible(); await expect(page.locator('#namespace-scope')).toHaveCount(1);
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
});

test('dark mobile mark renders and anonymous account opens sign-in guidance', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.addInitScript(() => localStorage.setItem('quay-next.theme', 'dark'));
  await page.route('**/api/v1/user/', route => route.fulfill({json: {anonymous: true}}));
  await page.goto(base);
  await expect(page.locator('.qn-brand-mark')).toHaveCSS('background-image', /quay-mark-dark/);
  const markLoaded = await page.locator('.qn-brand-mark').evaluate(async mark => {
    const image = new Image();
    image.src = getComputedStyle(mark).backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1] ?? '';
    try { await image.decode(); return image.naturalWidth > 0; } catch { return false; }
  });
  expect(markLoaded).toBe(true);
  await page.getByRole('button', {name: 'Sign-in help and session'}).click();
  await expect(page.getByRole('dialog', {name: 'Preview controls & session'})).toBeVisible();
});

test('mobile repository preview is a main page with a safe return', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844}); await page.goto(base);
  await page.getByRole('button', {name: 'Preview payments', exact: true}).click();
  await expect(page.getByRole('heading', {level: 1, name: 'payments', exact: true})).toBeVisible();
  await expect(page.getByRole('complementary')).toHaveCount(0);
  await page.getByRole('button', {name: 'Back to repositories', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Preview payments', exact: true})).toBeFocused();
});

for (const width of [320, 390, 768, 1024, 1440, 1536]) {
  test(`v2 fixture reflows at ${width}px and emits an actual render for review`, async ({page}, testInfo) => {
    await page.setViewportSize({width, height: 900}); await page.goto(base);
    await expect(page.getByRole('heading', {name: 'Repositories', exact: true})).toBeVisible();
    await expect(page.getByText('25 loaded', {exact: false})).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await testInfo.attach(`workbench-${width}`, {body: await page.screenshot({fullPage: false}), contentType: 'image/png'});
    // A screenshot attachment is not automatically a visual pass. Review it; never bless differences blindly.
  });
}

test('200 percent root text scaling does not cause document overflow on mobile', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844}); await page.goto(base);
  await expect(page.getByRole('list', {name: 'Repositories', exact: true})).toBeVisible();
  await page.evaluate(() => {document.documentElement.style.fontSize = '200%';});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  // This is text scaling, not evidence for actual browser zoom. Test real 200% and 400% zoom separately.
});


test('Find repository focuses search once and preserves later preview and filter focus', async ({page}) => {
  await page.goto(repo);
  await page.getByRole('button', {name: 'Find a repository', exact: true}).click();
  await expect(page.getByRole('searchbox', {name: 'Filter repositories on this page'})).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.history.state?.usr?.focusRepositorySearch)).toBeUndefined();
  const trigger = page.getByRole('button', {name: 'Preview payments', exact: true});
  await trigger.click();
  await expect(page.getByRole('heading', {name: 'payments', exact: true})).toBeFocused();
  await page.getByRole('button', {name: 'Close repository preview', exact: true}).click();
  await expect(trigger).toBeFocused();
  const sort = page.getByRole('combobox', {name: 'Sort repositories on this page'});
  await sort.focus();
  await sort.selectOption('name');
  await expect(sort).toBeFocused();
  const filter = page.getByRole('button', {name: /^Private/});
  await filter.focus();
  await page.keyboard.press('Enter');
  await expect(filter).toBeFocused();
});

for (const inspected of [false, true]) {
  test(`offscreen platform rows ${inspected ? 'retain the inspector shared request' : 'cancel their unobserved request'}`, async ({page}) => {
    const pending = [];
    await page.route('**/manifest/*', route => { pending.push(route); });
    await page.goto(repo);
    await expect.poll(() => pending.length).toBe(1);
    if (inspected) {
      await page.getByRole('link', {name: 'v2.8.1', exact: true}).click();
      await expect(page.locator('#artifact-heading')).toBeVisible();
    }
    const failed = inspected ? null : page.waitForEvent('requestfailed', {
      predicate: request => request === pending[0].request(),
      timeout: 5000, // Cancellation must beat RegistryClient's 15-second timeout.
    });
    // Scroll the actual rows beyond IntersectionObserver's 160px margin.
    await page.evaluate(() => {
      document.querySelector('.qn-repository-workspace').style.paddingBottom = '2000px';
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await expect(page.getByText('Platform details pending', {exact: true})).toHaveCount(2);
    if (failed) await failed;
    else {
      await pending[0].continue();
      await expect(page.getByText('linux/amd64', {exact: true}).first()).toBeAttached();
      expect(pending).toHaveLength(1);
    }
  });
}

test('desktop demo overview is passive and all loaded rows remain reachable in the bounded list', async ({page}) => {
  await page.setViewportSize({width: 1536, height: 1024});
  const securityRequests = [];
  page.on('request', request => {
    if (request.url().includes('/security?')) securityRequests.push(request.url());
  });
  await page.goto(base);
  const overview = page.getByRole('complementary', {name: 'payments', exact: true});
  await expect(overview).toBeVisible();
  await expect(overview.getByRole('heading', {name: 'payments', exact: true})).not.toBeFocused();
  await expect(page).not.toHaveURL(/preview=/);
  const rows = page.getByRole('region', {name: 'Repository rows', exact: true});
  await expect(rows.getByRole('row')).toHaveCount(26);
  expect(await rows.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
  await rows.getByRole('link', {name: 'service-20', exact: true}).scrollIntoViewIfNeeded();
  await expect(rows.getByRole('link', {name: 'service-20', exact: true})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(securityRequests).toHaveLength(0);
  await page.getByRole('button', {name: 'Close repository preview', exact: true}).click();
  await expect(overview).toHaveCount(0);
  await expect(page.getByRole('heading', {name: 'Repositories', exact: true})).toBeFocused();
});

for (const approved of ['payments', 'service-40']) {
  test(`initial live overview passively loads only first approved repository ${approved}`, async ({page}) => {
    await page.setViewportSize({width: 1536, height: 960});
    await page.route('**/__quay_next_preview__/runtime.json', route => route.fulfill({status: 200, json: {
      mode: 'live', namespaces: ['acme'], repositories: [`acme/${approved}`, 'acme/worker'],
      initialNamespace: 'acme', registryHost: 'quay.io',
    }}));
    const requests = [];
    page.on('request', request => {
      if (request.url().includes('/api/v1/repository/')) requests.push(request);
    });
    // Observe focus/history from document creation, including transient mutations.
    await page.addInitScript(() => {
      window.previewFocus = [];
      window.previewHistory = [];
      document.addEventListener('focusin', event => window.previewFocus.push(event.target.id));
      for (const method of ['pushState', 'replaceState']) {
        const original = history[method].bind(history);
        history[method] = (...args) => {
          if (args[2] != null) window.previewHistory.push(String(args[2]));
          return original(...args);
        };
      }
    });
    await page.goto(`${base}?namespace=acme`);
    const overview = page.getByRole('complementary', {name: approved, exact: true});
    await expect(overview).toBeVisible();
    await expect(overview.getByRole('heading', {name: 'Your access', exact: true})).toBeVisible();
    await expect(overview.getByRole('link', {name: 'v2.8.1', exact: true})).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${base}\\?namespace=acme$`));
    expect(await page.evaluate(() => window.previewFocus)).toEqual([]);
    expect(await page.evaluate(() => window.previewHistory)).toEqual([]);
    expect(requests.map(request => {
      const url = new URL(request.url());
      return [request.method(), decodeURIComponent(url.pathname), url.search];
    }).sort()).toEqual([
      ['GET', `/api/v1/repository/acme/${approved}`, '?includeTags=false'],
      ['GET', `/api/v1/repository/acme/${approved}/tag/`, '?page=1&limit=25&onlyActiveTags=true'],
    ].sort());
    // Resizing hides the passive panel without turning it into a detail page.
    await page.setViewportSize({width: 390, height: 844});
    await expect(page.getByTestId('repository-preview')).toHaveCount(0);
    await expect(page.getByRole('list', {name: 'Repositories', exact: true})).toBeVisible();
    expect(requests).toHaveLength(2);
  });
}

for (const scenario of ['narrow', 'different namespace']) {
  test(`live first approved overview remains list-first for ${scenario}`, async ({page}) => {
    await page.setViewportSize({width: scenario === 'narrow' ? 390 : 1536, height: 960});
    await page.route('**/__quay_next_preview__/runtime.json', route => route.fulfill({status: 200, json: {
      mode: 'live', namespaces: ['acme', 'other'],
      repositories: [scenario === 'narrow' ? 'acme/payments' : 'other/payments', 'acme/worker'],
      initialNamespace: 'acme', registryHost: 'quay.io',
    }}));
    const details = [];
    page.on('request', request => {
      if (request.url().includes('/api/v1/repository/')) details.push(request.url());
    });
    await page.goto(`${base}?namespace=acme`);
    const collection = page.getByRole(scenario === 'narrow' ? 'list' : 'table', {name: 'Repositories', exact: true});
    await expect(collection.getByText('payments', {exact: true})).toBeVisible();
    await expect(page.getByTestId('repository-preview')).toHaveCount(0);
    expect(details).toEqual([]);
  });
}

test('Find has one visible action and its keyboard shortcut focuses the repository filter', async ({page}) => {
  await page.goto(repo);
  await expect(page.getByRole('button', {name: 'Find a repository', exact: true})).toHaveCount(1);
  await expect(page.locator('.qn-feature-strip')).toHaveCount(0);
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('searchbox', {name: 'Filter repositories on this page'})).toBeFocused();
  await expect(page.locator('.qn-feature-strip')).toBeVisible();
  await page.setViewportSize({width: 390, height: 844});
  await expect(page.getByRole('button', {name: 'Find a repository', exact: true})).toBeVisible();
});
