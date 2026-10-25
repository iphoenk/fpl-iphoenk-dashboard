import {defineConfig} from '@playwright/test';
const port=Number(process.env.FPL_E2E_PORT||4180);
export default defineConfig({
  testDir:'tests/browser',
  testMatch:'**/*.spec.mjs',
  timeout:60000,
  retries:0,
  reporter:[['list']],
  use:{baseURL:'http://127.0.0.1:'+port,trace:'retain-on-failure'},
  projects:[{name:'chromium',use:{browserName:'chromium'}}],
  // Build the worker bundle first; the preview server then serves it locally. Tests never call the live FPL API.
  webServer:{command:'npm run build && node scripts/preview.mjs',url:'http://127.0.0.1:'+port,env:{FPL_PREVIEW_PORT:String(port)},reuseExistingServer:!process.env.CI,timeout:120000}
});
