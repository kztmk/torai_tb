import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { defineConfig, devices, type ReporterDescription } from 'playwright/test';

const baseURL = process.env.OPERATION_BASE_URL ?? 'http://127.0.0.1:5173';
const operationEnvMode = process.env.OPERATION_ENV_MODE ?? 'development';
const skipWebServer = process.env.OPERATION_SKIP_WEBSERVER === '1';
const storageState = process.env.OPERATION_STORAGE_STATE;
const reporter: 'list' | ReporterDescription[] =
  process.env.OPERATION_HTML_REPORT === '1'
    ? [['list'], ['html', { outputFolder: 'playwright-report/operation', open: 'never' }]]
    : 'list';

const parseEnvFile = (filePath: string): Record<string, string> => {
  if (!existsSync(filePath)) {
    return {};
  }

  return readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce<Record<string, string>>((envValues, line) => {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
        return envValues;
      }

      const match = trimmedLine.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);

      if (!match) {
        return envValues;
      }

      const [, envKey, rawValue] = match;
      const envValue = rawValue.trim().replace(/^(['"])(.*)\1$/, '$2');

      envValues[envKey] = envValue;
      return envValues;
    }, {});
};

const loadOperationEnv = (mode: string): Record<string, string> => {
  const cwd = process.cwd();
  const envFiles = ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`];

  return envFiles.reduce<Record<string, string>>(
    (envValues, envFile) => ({
      ...envValues,
      ...parseEnvFile(path.join(cwd, envFile)),
    }),
    {}
  );
};

const envFromViteMode = loadOperationEnv(operationEnvMode);

for (const [envKey, envValue] of Object.entries(envFromViteMode)) {
  process.env[envKey] ??= envValue;
}

export default defineConfig({
  testDir: './tests/operation/specs',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    storageState,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: skipWebServer
    ? undefined
    : {
        command: `node node_modules/vite/bin/vite.js --mode ${operationEnvMode} --host 127.0.0.1`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
