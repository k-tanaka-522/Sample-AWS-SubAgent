# E2Eテスト (Playwright)

役所設備管理システムのE2Eテスト（End-to-End Test）です。

## 概要

**ツール**: Playwright
**対象**: フロントエンド（vendor-spa） + バックエンド（vendor-api）
**ブラウザ**: Chromium、Firefox、WebKit（Safari）

## セットアップ

```bash
# ディレクトリ移動
cd e2e

# 依存パッケージのインストール
npm install

# Playwrightブラウザのインストール
npx playwright install
```

## テスト実行

### 全テスト実行（ヘッドレスモード）

```bash
npm test
```

### ブラウザを表示して実行

```bash
npm run test:headed
```

### UIモードで実行（デバッグに便利）

```bash
npm run test:ui
```

### 特定のブラウザのみ実行

```bash
# Chromiumのみ
npm run test:chromium

# Firefoxのみ
npm run test:firefox

# WebKitのみ
npm run test:webkit
```

### HTMLレポートを表示

```bash
npm run report
```

## テストケース一覧

### 1. ログイン機能 (`login.spec.ts`)

| テストケース | 説明 |
|------------|------|
| 正常系: 正しい認証情報でログインできる | Cognito認証成功 |
| 異常系: 間違ったパスワードでエラー表示 | エラーメッセージ表示 |
| 異常系: メールアドレス未入力でバリデーションエラー | 必須チェック |
| UI: ログインフォームが正しく表示される | UI検証 |
| セキュリティ: パスワード入力欄がマスクされている | type="password" |
| 正常系: ログアウトできる | セッション破棄 |

### 2. 設備一覧機能 (`facility-list.spec.ts`)

| テストケース | 説明 |
|------------|------|
| 正常系: 設備一覧が表示される | API連携 |
| 正常系: 設備詳細ページに遷移できる | ルーティング |
| UI: ローディング状態が表示される | UX |
| 異常系: APIエラー時のエラーメッセージ表示 | エラーハンドリング |
| 正常系: 設備詳細情報が表示される | データ表示 |
| 正常系: 保守履歴が表示される | 関連データ |
| 正常系: 一覧に戻るボタンが機能する | ナビゲーション |

### 3. 保守報告機能 (`maintenance-report.spec.ts`)

| テストケース | 説明 |
|------------|------|
| 正常系: 保守報告フォームが表示される | UI検証 |
| 正常系: 保守報告を登録できる | データ登録 |
| 正常系: 次回保守予定日なしでも登録できる | オプション項目 |
| 異常系: 必須項目未入力でバリデーションエラー | 入力検証 |
| 異常系: 不正な日付フォーマットでエラー | フォーマット検証 |
| UI: フォームのリセットボタンが機能する | UX |
| E2E: 設備一覧 → 詳細 → 保守報告 → 履歴確認 | フルフロー |

## 環境変数

`.env` ファイルを作成し、テスト用の認証情報を設定してください。

```bash
# .env
E2E_BASE_URL=http://localhost:3001
E2E_TEST_EMAIL=test@example.com
E2E_TEST_PASSWORD=TestPass123!
```

**注意**: `.env` はGitにコミットしないでください（`.gitignore`に追加済み）。

## CI/CD統合

GitHub Actionsでの実行例:

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: |
          cd e2e
          npm ci
      - name: Install Playwright Browsers
        run: npx playwright install --with-deps
      - name: Run E2E tests
        run: npm test
        env:
          E2E_BASE_URL: https://staging.facility.example.com
          E2E_TEST_EMAIL: ${{ secrets.E2E_TEST_EMAIL }}
          E2E_TEST_PASSWORD: ${{ secrets.E2E_TEST_PASSWORD }}
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: e2e/test-results/
```

## トラブルシューティング

### ブラウザが起動しない

```bash
# ブラウザを再インストール
npx playwright install --force
```

### タイムアウトエラー

`playwright.config.ts` の `timeout` 設定を増やしてください。

```typescript
use: {
  actionTimeout: 10000, // 10秒
  navigationTimeout: 30000, // 30秒
}
```

### 認証エラー

`.env` ファイルのテストユーザー認証情報が正しいか確認してください。

## 参考リンク

- [Playwright公式ドキュメント](https://playwright.dev/)
- [ベストプラクティス](https://playwright.dev/docs/best-practices)
