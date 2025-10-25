import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2Eテスト設定
 *
 * 参照: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',

  // 並列実行設定
  fullyParallel: true,

  // CIでは失敗したテストのみリトライ
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  // 並列ワーカー数
  workers: process.env.CI ? 1 : undefined,

  // レポート形式
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  // 共通設定
  use: {
    // ベースURL（環境変数で上書き可能）
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',

    // トレース設定（失敗時のみ記録）
    trace: 'on-first-retry',

    // スクリーンショット（失敗時のみ）
    screenshot: 'only-on-failure',

    // ビデオ（失敗時のみ）
    video: 'retain-on-failure',
  },

  // テスト対象ブラウザ
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // モバイルテスト（必要に応じて有効化）
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
  ],

  // ローカル開発サーバーの起動（オプション）
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3001',
  //   reuseExistingServer: !process.env.CI,
  // },
});
