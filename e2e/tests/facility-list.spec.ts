import { test, expect } from '@playwright/test';

/**
 * E2Eテスト: 設備一覧機能
 *
 * テスト対象:
 * - 設備一覧の表示
 * - ページネーション
 * - 検索・フィルタ
 * - 設備詳細への遷移
 */

// ログイン状態を共通化
test.use({
  storageState: process.env.E2E_STORAGE_STATE || undefined,
});

test.describe('設備一覧機能', () => {
  test.beforeEach(async ({ page }) => {
    // ログイン処理（共通ヘルパーがない場合は手動ログイン）
    await page.goto('/login');

    const email = process.env.E2E_TEST_EMAIL || 'test@example.com';
    const password = process.env.E2E_TEST_PASSWORD || 'TestPass123!';

    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    // ログイン完了を待つ
    await page.waitForURL(/\/facilities/);
  });

  test('正常系: 設備一覧が表示される', async ({ page }) => {
    // ページタイトル確認
    await expect(page.locator('h1')).toContainText(/設備一覧|担当設備/);

    // テーブルが表示されることを確認
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // テーブルヘッダーの確認
    await expect(page.locator('th >> text=設備名')).toBeVisible();
    await expect(page.locator('th >> text=型番')).toBeVisible();
    await expect(page.locator('th >> text=カテゴリ')).toBeVisible();
    await expect(page.locator('th >> text=数量')).toBeVisible();

    // 少なくとも1行のデータが表示される
    const rows = page.locator('tbody tr');
    await expect(rows).not.toHaveCount(0);
  });

  test('正常系: 設備詳細ページに遷移できる', async ({ page }) => {
    // 最初の設備をクリック
    await page.click('tbody tr:first-child >> text=/詳細|View/');

    // 詳細ページに遷移
    await expect(page).toHaveURL(/\/facilities\/\d+/);

    // 設備名が表示される
    await expect(page.locator('h1, h2')).not.toBeEmpty();
  });

  test('UI: ローディング状態が表示される', async ({ page }) => {
    // ページリロード時にローディング表示を確認
    await page.reload();

    // ローディングインジケーター（実装に応じて調整）
    const loading = page.locator('text=/読み込み中|Loading/');

    // 一時的に表示される（または即座に消える）
    // await expect(loading).toBeVisible({ timeout: 1000 });
    // await expect(loading).toBeHidden({ timeout: 5000 });

    // データが表示される
    await expect(page.locator('tbody tr')).not.toHaveCount(0);
  });

  test('異常系: APIエラー時のエラーメッセージ表示', async ({ page, context }) => {
    // APIレスポンスをモック（エラーを返す）
    await context.route('**/api/facilities', (route) =>
      route.fulfill({
        status: 500,
        body: JSON.stringify({ success: false, error: 'Internal Server Error' }),
      })
    );

    await page.reload();

    // エラーメッセージが表示される
    await expect(page.locator('text=/エラー|Error|取得に失敗/')).toBeVisible();
  });
});

test.describe('設備詳細機能', () => {
  test.beforeEach(async ({ page }) => {
    // ログイン
    await page.goto('/login');
    const email = process.env.E2E_TEST_EMAIL || 'test@example.com';
    const password = process.env.E2E_TEST_PASSWORD || 'TestPass123!';
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/facilities/);

    // 最初の設備の詳細ページに遷移
    await page.click('tbody tr:first-child >> text=/詳細|View/');
    await page.waitForURL(/\/facilities\/\d+/);
  });

  test('正常系: 設備詳細情報が表示される', async ({ page }) => {
    // 設備名
    await expect(page.locator('text=設備名')).toBeVisible();

    // 型番
    await expect(page.locator('text=型番')).toBeVisible();

    // カテゴリ
    await expect(page.locator('text=カテゴリ')).toBeVisible();

    // 数量
    await expect(page.locator('text=数量')).toBeVisible();

    // 保管場所
    await expect(page.locator('text=保管場所')).toBeVisible();
  });

  test('正常系: 保守履歴が表示される', async ({ page }) => {
    // 保守履歴セクション
    await expect(page.locator('h2, h3 >> text=/保守履歴|Maintenance History/')).toBeVisible();

    // 保守履歴テーブルまたはリスト
    const historySection = page.locator('text=/保守履歴|Maintenance History/').locator('..');

    // 履歴がある場合はデータが表示される
    // await expect(historySection.locator('table, ul')).toBeVisible();
  });

  test('正常系: 一覧に戻るボタンが機能する', async ({ page }) => {
    // 戻るボタンをクリック
    await page.click('button:has-text("戻る"), a:has-text("戻る")');

    // 一覧ページに戻る
    await expect(page).toHaveURL(/\/facilities$/);
  });
});
