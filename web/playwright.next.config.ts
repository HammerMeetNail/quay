import {defineConfig, devices} from '@playwright/test';
export default defineConfig({
  testDir: './next-tests/browser', outputDir: './next-tests/results', fullyParallel: false,
  forbidOnly: Boolean(process.env.CI), retries: 0, reporter: 'line',
  use: {baseURL: 'http://127.0.0.1:9001', trace: 'off', video: 'off', screenshot: 'only-on-failure'},
  webServer: {command: 'node tools/next/server.mjs dist-next', url: 'http://127.0.0.1:9001/__quay_next_preview__/', reuseExistingServer: false},
  projects: [{name: 'chromium', use: {...devices['Desktop Chrome']}}],
});
