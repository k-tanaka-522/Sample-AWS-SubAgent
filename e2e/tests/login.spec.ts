import { test, expect } from '@playwright/test';

/**
 * E2Eテスト: ログイン機能
 *
 * テスト対象:
 * - Cognito認証フロー
 * - ログイン後のリダイレクト
 * - エラーハンドリング
 */

test.describe('ログイン機能', () => {
  test.beforeEach(async ({ page }) => {
    // ログインページに遷移
    await page.goto('/login');
  });

  test('正常系: 正しい認証情報でログインできる', async ({ page }) => {
    // テストユーザーの認証情報（環境変数から取得）
    const email = process.env.E2E_TEST_EMAIL || 'test@example.com';
    const password = process.env.E2E_TEST_PASSWORD || 'TestPass123!';

    // メールアドレス入力
    await page.fill('input[name="email"]', email);

    // パスワード入力
    await page.fill('input[name="password"]', password);

    // ログインボタンをクリック
    await page.click('button[type="submit"]');

    // ログイン成功後、設備一覧ページにリダイレクト
    await expect(page).toHaveURL(/\/facilities/);

    // ログインユーザー情報が表示されることを確認
    await expect(page.locator('text=ログイン中')).toBeVisible();
  });

  test('異常系: 間違ったパスワードでエラー表示', async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL || 'test@example.com';
    const wrongPassword = 'WrongPassword123!';

    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', wrongPassword);
    await page.click('button[type="submit"]');

    // エラーメッセージが表示される
    await expect(page.locator('text=/認証に失敗|パスワードが正しくありません/')).toBeVisible();

    // ログインページに留まる
    await expect(page).toHaveURL(/\/login/);
  });

  test('異常系: メールアドレス未入力でバリデーションエラー', async ({ page }) => {
    // パスワードのみ入力
    await page.fill('input[name="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');

    // ブラウザのバリデーションエラーまたはカスタムエラー
    const emailInput = page.locator('input[name="email"]');
    await expect(emailInput).toHaveAttribute('required', '');
  });

  test('UI: ログインフォームが正しく表示される', async ({ page }) => {
    // ロゴ・タイトルの確認
    await expect(page.locator('h1')).toContainText(/ログイン|サインイン/);

    // メールアドレス入力欄
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('label >> text=メールアドレス')).toBeVisible();

    // パスワード入力欄
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('label >> text=パスワード')).toBeVisible();

    // ログインボタン
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('セキュリティ: パスワード入力欄がマスクされている', async ({ page }) => {
    const passwordInput = page.locator('input[name="password"]');

    // type="password" 属性が設定されている
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });
});

test.describe('ログアウト機能', () => {
  test.beforeEach(async ({ page }) => {
    // ログイン状態を作成（テストヘルパーまたは手動ログイン）
    await page.goto('/login');

    const email = process.env.E2E_TEST_EMAIL || 'test@example.com';
    const password = process.env.E2E_TEST_PASSWORD || 'TestPass123!';

    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    // ログイン完了を待つ
    await page.waitForURL(/\/facilities/);
  });

  test('正常系: ログアウトできる', async ({ page }) => {
    // ログアウトボタンをクリック
    await page.click('button:has-text("ログアウト")');

    // ログインページにリダイレクト
    await expect(page).toHaveURL(/\/login/);

    // 設備一覧ページに直接アクセスできない（要認証）
    await page.goto('/facilities');
    await expect(page).toHaveURL(/\/login/);
  });
});
