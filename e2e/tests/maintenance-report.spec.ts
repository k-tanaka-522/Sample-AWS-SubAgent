import { test, expect } from '@playwright/test';

/**
 * E2Eテスト: 保守報告機能
 *
 * テスト対象:
 * - 保守報告フォームの表示
 * - 保守報告の登録
 * - バリデーション
 * - 成功メッセージの表示
 */

test.describe('保守報告機能', () => {
  test.beforeEach(async ({ page }) => {
    // ログイン
    await page.goto('/login');

    const email = process.env.E2E_TEST_EMAIL || 'test@example.com';
    const password = process.env.E2E_TEST_PASSWORD || 'TestPass123!';

    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/facilities/);

    // 保守報告ページに遷移
    await page.goto('/report');
  });

  test('正常系: 保守報告フォームが表示される', async ({ page }) => {
    // ページタイトル
    await expect(page.locator('h1')).toContainText(/保守報告|Maintenance Report/);

    // フォーム要素の確認
    await expect(page.locator('select[name="equipment_id"], input[name="equipment_id"]')).toBeVisible();
    await expect(page.locator('input[name="report_date"]')).toBeVisible();
    await expect(page.locator('textarea[name="description"]')).toBeVisible();
    await expect(page.locator('input[name="next_maintenance_date"]')).toBeVisible();

    // 送信ボタン
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('正常系: 保守報告を登録できる', async ({ page }) => {
    // 設備選択（ドロップダウンまたは入力）
    const equipmentSelect = page.locator('select[name="equipment_id"]');
    if (await equipmentSelect.isVisible()) {
      await equipmentSelect.selectOption({ index: 1 });
    } else {
      await page.fill('input[name="equipment_id"]', '1');
    }

    // 報告日
    await page.fill('input[name="report_date"]', '2024-10-25');

    // 作業内容
    await page.fill('textarea[name="description"]', 'E2Eテスト: 定期点検を実施しました。');

    // 次回保守予定日
    await page.fill('input[name="next_maintenance_date"]', '2024-11-25');

    // 送信
    await page.click('button[type="submit"]');

    // 成功メッセージが表示される
    await expect(page.locator('text=/登録しました|成功|Success/')).toBeVisible({ timeout: 10000 });

    // 一覧ページにリダイレクトされる（または同じページで成功表示）
    // await expect(page).toHaveURL(/\/facilities/);
  });

  test('正常系: 次回保守予定日なしでも登録できる', async ({ page }) => {
    const equipmentSelect = page.locator('select[name="equipment_id"]');
    if (await equipmentSelect.isVisible()) {
      await equipmentSelect.selectOption({ index: 1 });
    } else {
      await page.fill('input[name="equipment_id"]', '1');
    }

    await page.fill('input[name="report_date"]', '2024-10-25');
    await page.fill('textarea[name="description"]', 'E2Eテスト: 次回保守予定日なし');

    // 次回保守予定日は入力しない

    await page.click('button[type="submit"]');

    await expect(page.locator('text=/登録しました|成功|Success/')).toBeVisible({ timeout: 10000 });
  });

  test('異常系: 必須項目未入力でバリデーションエラー', async ({ page }) => {
    // 何も入力せずに送信
    await page.click('button[type="submit"]');

    // バリデーションエラーメッセージが表示される
    await expect(
      page.locator('text=/必須|required|入力してください/')
    ).toBeVisible();
  });

  test('異常系: 不正な日付フォーマットでエラー', async ({ page }) => {
    const equipmentSelect = page.locator('select[name="equipment_id"]');
    if (await equipmentSelect.isVisible()) {
      await equipmentSelect.selectOption({ index: 1 });
    } else {
      await page.fill('input[name="equipment_id"]', '1');
    }

    // 不正な日付フォーマット
    await page.fill('input[name="report_date"]', 'invalid-date');
    await page.fill('textarea[name="description"]', 'テスト');

    await page.click('button[type="submit"]');

    // エラーメッセージが表示される
    await expect(
      page.locator('text=/無効|invalid|正しい日付/')
    ).toBeVisible();
  });

  test('UI: フォームのリセットボタンが機能する', async ({ page }) => {
    // データ入力
    const equipmentSelect = page.locator('select[name="equipment_id"]');
    if (await equipmentSelect.isVisible()) {
      await equipmentSelect.selectOption({ index: 1 });
    }
    await page.fill('input[name="report_date"]', '2024-10-25');
    await page.fill('textarea[name="description"]', 'テストデータ');

    // リセットボタンをクリック（存在する場合）
    const resetButton = page.locator('button:has-text("リセット"), button:has-text("クリア")');
    if (await resetButton.isVisible()) {
      await resetButton.click();

      // フォームがクリアされる
      await expect(page.locator('textarea[name="description"]')).toHaveValue('');
    }
  });
});

test.describe('保守報告フロー（E2E）', () => {
  test('設備一覧 → 詳細 → 保守報告 → 履歴確認', async ({ page }) => {
    // 1. ログイン
    await page.goto('/login');
    const email = process.env.E2E_TEST_EMAIL || 'test@example.com';
    const password = process.env.E2E_TEST_PASSWORD || 'TestPass123!';
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/facilities/);

    // 2. 設備一覧から最初の設備を選択
    await page.click('tbody tr:first-child >> text=/詳細|View/');
    await page.waitForURL(/\/facilities\/\d+/);

    // 設備IDを取得（URLから）
    const url = page.url();
    const equipmentId = url.match(/\/facilities\/(\d+)/)?.[1];
    expect(equipmentId).toBeDefined();

    // 3. 保守報告ページに遷移
    await page.goto('/report');

    // 4. 保守報告を登録
    const equipmentSelect = page.locator('select[name="equipment_id"]');
    if (await equipmentSelect.isVisible()) {
      await equipmentSelect.selectOption({ value: equipmentId });
    } else {
      await page.fill('input[name="equipment_id"]', equipmentId!);
    }

    await page.fill('input[name="report_date"]', '2024-10-25');
    await page.fill('textarea[name="description"]', 'E2Eフローテスト: 保守完了');
    await page.fill('input[name="next_maintenance_date"]', '2024-11-25');

    await page.click('button[type="submit"]');

    // 成功メッセージ確認
    await expect(page.locator('text=/登録しました|成功|Success/')).toBeVisible({ timeout: 10000 });

    // 5. 設備詳細ページに戻って履歴を確認
    await page.goto(`/facilities/${equipmentId}`);

    // 保守履歴セクション
    await expect(page.locator('text=/保守履歴|Maintenance History/')).toBeVisible();

    // 登録した報告が表示される（最新の履歴に含まれる）
    await expect(page.locator('text=E2Eフローテスト: 保守完了')).toBeVisible({ timeout: 10000 });
  });
});
