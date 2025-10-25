# セキュリティテスト

役所設備管理システムのセキュリティテストです。

## 概要

**ツール**:
- Jest（アプリケーションセキュリティ）
- cfn_nag（CloudFormationセキュリティ）

**対象**:
- SQLインジェクション対策
- XSS（クロスサイトスクリプティング）対策
- 認証・認可機能
- CloudFormationテンプレートのセキュリティベストプラクティス

## セットアップ

```bash
# ディレクトリ移動
cd security

# 依存パッケージのインストール
npm install

# cfn_nag のインストール（CloudFormationチェック用）
gem install cfn-nag
```

## テスト実行

### 1. アプリケーションセキュリティテスト

#### 全テスト実行

```bash
npm test
```

#### 個別テスト実行

```bash
# SQLインジェクション対策
npm run test:sql-injection

# XSS対策
npm run test:xss

# 認証・認可
npm run test:auth
```

### 2. CloudFormationセキュリティチェック

```bash
npm run cfn-nag
```

**チェック項目**:
- S3バケットの暗号化設定
- Security Groupの0.0.0.0/0禁止
- IAMロールの最小権限
- RDS暗号化有効化
- CloudTrail有効化
- パブリックアクセスの制限

## テストケース一覧

### 1. SQLインジェクション対策 (`sql-injection.test.ts`)

| テストケース | 説明 |
|------------|------|
| シングルクォート攻撃を防御 | `1' OR '1'='1` |
| UNION SELECT攻撃を防御 | `1 UNION SELECT ...` |
| DROP TABLE攻撃を防御 | `1; DROP TABLE ...` |
| LIKE句での攻撃を防御 | `%'; DROP TABLE ...` |
| Prepared Statementの使用確認 | パラメータ化クエリ |

**対策**:
- すべてのSQLクエリでPrepared Statement（パラメータ化クエリ）を使用
- ユーザー入力を直接SQLに埋め込まない

**実装例**:
```typescript
// ✅ Good: Prepared Statement
const result = await pool.query('SELECT * FROM equipment WHERE equipment_id = $1', [equipmentId]);

// ❌ Bad: 文字列連結（SQLインジェクションの脆弱性）
const result = await pool.query(`SELECT * FROM equipment WHERE equipment_id = ${equipmentId}`);
```

### 2. XSS対策 (`xss.test.ts`)

| テストケース | 説明 |
|------------|------|
| `<script>` タグの扱い | データベースには生の文字列として保存 |
| ReactのデフォルトエスケープCD | フロントエンドで自動エスケープ |
| dangerouslySetInnerHTML 不使用 | コードレビューで確認 |
| Content-Type確認 | `application/json` |

**対策**:
- **バックエンド**: データはそのまま保存（エスケープしない）
- **フロントエンド**: Reactが自動でエスケープ
- **禁止事項**: `dangerouslySetInnerHTML` の使用禁止

**Reactの安全な実装**:
```tsx
// ✅ Good: 自動エスケープ
<div>{description}</div>
// 出力: <div>&lt;script&gt;alert("XSS")&lt;/script&gt;</div>

// ❌ Bad: XSS脆弱性
<div dangerouslySetInnerHTML={{ __html: description }} />
// 出力: <div><script>alert("XSS")</script></div> ← 実行される
```

### 3. 認証・認可 (`auth.test.ts`)

| テストケース | 説明 |
|------------|------|
| 認証なしで401エラー | Authorizationヘッダーなし |
| 不正なJWTで401エラー | 署名が異なるトークン |
| 期限切れトークンで401エラー | `exp` クレームを検証 |
| 改ざんトークンで401エラー | JWT署名検証 |
| Row-Level Security | 他社データにアクセスできない |

**対策**:
- Cognito JWTトークンの署名検証
- トークン有効期限の確認
- Row-Level Security（RLS）によるデータ分離

**実装例**:
```typescript
// JWT検証ミドルウェア
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const client = jwksClient({
  jwksUri: `https://cognito-idp.{region}.amazonaws.com/{userPoolId}/.well-known/jwks.json`
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

app.use((req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  jwt.verify(token, getKey, { algorithms: ['RS256'] }, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Unauthorized' });
    req.user = decoded;
    next();
  });
});
```

### 4. CloudFormationセキュリティチェック (`cfn-nag-check.sh`)

**チェック項目**:

| 項目 | ルール | 修正方法 |
|------|--------|---------|
| S3暗号化 | WARN F14 | `BucketEncryption` プロパティを追加 |
| Security Group | FAIL F1000 | 0.0.0.0/0 を削除、特定IPのみ許可 |
| IAM権限 | WARN W11 | Resource: "*" を具体的なARNに変更 |
| RDS暗号化 | FAIL F3 | `StorageEncrypted: true` |
| CloudTrail | WARN W35 | CloudTrailを有効化 |

**修正例**:

```yaml
# ❌ Bad: S3暗号化なし
MyBucket:
  Type: AWS::S3::Bucket

# ✅ Good: S3暗号化あり
MyBucket:
  Type: AWS::S3::Bucket
  Properties:
    BucketEncryption:
      ServerSideEncryptionConfiguration:
        - ServerSideEncryptionByDefault:
            SSEAlgorithm: AES256

# ❌ Bad: Security Groupが0.0.0.0/0
SecurityGroup:
  Type: AWS::EC2::SecurityGroup
  Properties:
    SecurityGroupIngress:
      - IpProtocol: tcp
        FromPort: 22
        ToPort: 22
        CidrIp: 0.0.0.0/0

# ✅ Good: 特定IPのみ許可
SecurityGroup:
  Type: AWS::EC2::SecurityGroup
  Properties:
    SecurityGroupIngress:
      - IpProtocol: tcp
        FromPort: 22
        ToPort: 22
        CidrIp: 203.0.113.0/24  # 特定IPアドレス範囲
```

## セキュリティ基準への準拠

### OWASP Top 10 (2021)

| 項目 | 対策 | テスト |
|------|------|--------|
| A01: Broken Access Control | Row-Level Security、認証チェック | `auth.test.ts` |
| A02: Cryptographic Failures | RDS暗号化、TLS 1.3 | `cfn-nag-check.sh` |
| A03: Injection | Prepared Statement | `sql-injection.test.ts` |
| A04: Insecure Design | セキュアな設計 | レビュー |
| A05: Security Misconfiguration | CloudFormation検証 | `cfn-nag-check.sh` |
| A06: Vulnerable Components | npm audit、Dependabot | CI/CD |
| A07: Authentication Failures | Cognito、JWT検証 | `auth.test.ts` |
| A08: Software and Data Integrity | Git署名、CodeArtifact | CI/CD |
| A09: Security Logging Failures | CloudWatch Logs、CloudTrail | インフラ |
| A10: Server-Side Request Forgery | 外部API制限 | レビュー |

### 政府情報セキュリティ基準（ISMAP）

- ✅ 暗号化（保存時・転送時）
- ✅ アクセス制御（Row-Level Security）
- ✅ 監査ログ（CloudWatch Logs、CloudTrail）
- ✅ 多層防御（WAF、Security Group、VPC）

## CI/CD統合

GitHub Actionsでの実行例:

```yaml
# .github/workflows/security.yml
name: Security Tests

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: |
          cd security
          npm ci
      - name: Run security tests
        run: npm test
      - name: Install cfn_nag
        run: gem install cfn-nag
      - name: Run CloudFormation security check
        run: npm run cfn-nag
```

## トラブルシューティング

### cfn_nag がインストールできない

Rubyが必要です。

```bash
# macOS
brew install ruby

# Ubuntu
sudo apt-get install ruby-full
```

### テストが失敗する

データベース接続を確認してください。

```bash
# 環境変数設定
export DATABASE_URL=postgresql://user:pass@localhost/facility_db_test
```

## 参考リンク

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [cfn_nag](https://github.com/stelligent/cfn_nag)
- [AWS Well-Architected Framework - Security Pillar](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/welcome.html)
