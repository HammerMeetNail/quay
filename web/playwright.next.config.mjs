import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
  testDir:'./next-tests/browser',outputDir:'next-test-results',fullyParallel:false,workers:1,
  timeout:30000,expect:{timeout:10000},retries:0,reporter:'list',
  use:{baseURL:'http://127.0.0.1:4318',serviceWorkers:'block',trace:'off',video:'off',screenshot:'off'},
  webServer:{command:'node tools/next/demo.mjs',url:'http://127.0.0.1:4318/healthz',reuseExistingServer:false,timeout:15000},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome'],viewport:{width:1536,height:960}}},{name:'firefox',use:{...devices['Desktop Firefox'],viewport:{width:1536,height:960}}},{name:'webkit',use:{...devices['Desktop Safari'],viewport:{width:1536,height:960}}}],
});
