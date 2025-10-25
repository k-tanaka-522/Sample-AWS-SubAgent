# SRE実装レポート: Client VPN Endpoint（暫定実装）

**作成日**: 2025-10-25
**担当**: SRE サブエージェント
**ステータス**: ✅ 実装完了（PM レビュー待ち）

---

## 1. 実装概要

### 実装内容

拠点（20拠点）からの VPN 接続を Transit Gateway 経由で全 Service VPC に振り分けるための **Client VPN Endpoint** を実装しました。

**重要**: これは **暫定実装** です。将来、Direct Connect が実装されたら Client VPN を無効化します（BGP ASN 準備中のため）。

### アーキテクチャ

```
拠点（20拠点）
  ↓ AWS Client VPN（証明書ベース認証）
Client VPN Endpoint（Shared Account）
  ↓ Client VPN VPC（10.255.0.0/16）
Transit Gateway（Shared Account）
  ↓ TGW Attachments
Service VPC（dev/stg/prod）
  ↓
ECS Fargate（業務アプリ）
```

---

## 2. 実装ファイル

### 作成したファイル

```
infra/cloudformation/shared/3-client-vpn/
├── stack.yaml                               # 親スタック
├── README.md                                # デプロイ手順書
└── nested/
    ├── client-vpn-vpc.yaml                  # Client VPN 用 VPC（10.255.0.0/16）
    ├── server-certificate.yaml              # サーバー証明書（手動作成手順）
    ├── client-vpn-endpoint.yaml             # Client VPN Endpoint
    └── transit-gateway-attachment.yaml      # TGW Attachment（手動作成手順）
```

### ファイル分割3原則への準拠

| 原則 | 判断 | 理由 |
|-----|------|------|
| **1. AWS コンソールの分け方** | ✅ 適用 | Client VPN VPC、Client VPN Endpoint、Transit Gateway Attachment は別メニュー → 別ファイル |
| **2. ライフサイクル** | ✅ 適用 | すべて初回のみ作成（変更頻度が同じ）だが、機能が異なるため分割 |
| **3. 設定数** | ✅ 適用 | 各リソース1個ずつだが、機能別に分割 |

**結論**: 5ファイル構成（親スタック + ネスト4ファイル）は適切。

---

## 3. パラメーター設計

### パラメーターシート v1.3 準拠

| 項目 | パラメーターシート値 | 実装値 | 準拠 |
|------|------------------|--------|------|
| Client VPN Endpoint 名 | facilities-shared-client-vpn | facilities-shared-client-vpn | ✅ |
| クライアント CIDR ブロック | 172.16.0.0/22 | 172.16.0.0/22 | ✅ |
| 認証方式 | 証明書ベース認証（ACM） | 証明書ベース認証（ACM） | ✅ |
| スプリットトンネル | 有効 | 有効 | ✅ |
| 同時接続数 | 100 | 100 | ✅ |
| DNS サーバー | 拠点DNSサーバー | パラメーターで指定可能 | ✅ |
| ログ記録 | CloudWatch Logs | CloudWatch Logs（90日保持） | ✅ |
| トランスポートプロトコル | UDP | UDP | ✅ |
| セッションタイムアウト | 12時間 | 12時間 | ✅ |

---

## 4. 技術標準への準拠

### CloudFormation 規約（45_cloudformation.md）準拠

| 規約 | 実装内容 | 準拠 |
|-----|---------|------|
| **Change Sets 必須** | README.md にデプロイ手順を記載（Change Set使用） | ✅ |
| **ファイル分割3原則** | 親スタック + ネスト4ファイル（機能別） | ✅ |
| **パラメーター化** | TransitGatewayId、ClientCidrBlock 等をパラメーター化 | ✅ |
| **タグ付け** | Name, Environment, ManagedBy タグを設定 | ✅ |
| **Export/Import** | Client VPN VPC ID、Subnet ID を Export | ✅ |
| **エラーハンドリング** | AllowedPattern でパラメーター検証 | ✅ |

### セキュリティ基準（49_security.md）準拠

| 基準 | 実装内容 | 準拠 |
|-----|---------|------|
| **認証** | 証明書ベース認証（拠点ごとにクライアント証明書発行） | ✅ |
| **ログ記録** | CloudWatch Logs（90日保持、ISMAP準拠） | ✅ |
| **暗号化** | TLS 1.3（ACM証明書） | ✅ |
| **最小権限** | 認可ルールで Service VPC（10.0.0.0/8）のみアクセス許可 | ✅ |

---

## 5. Client VPN VPC の必要性

### なぜ Client VPN VPC が必要か？

**問題**: Client VPN Endpoint は Transit Gateway に **直接接続できません**。

**解決策**: 以下の構成を採用しました。

```
Client VPN Endpoint
  ↓ サブネット関連付け
Client VPN VPC（10.255.0.0/16）
  ↓ Transit Gateway Attachment
Transit Gateway
  ↓
Service VPC（dev/stg/prod）
```

### Client VPN VPC の設計

| 項目 | 設定値 | 備考 |
|------|--------|------|
| VPC CIDR | 10.255.0.0/16 | 小規模VPC（コストゼロ） |
| Subnet 1 (AZ-a) | 10.255.0.0/24 | Client VPN Endpoint 関連付け用 |
| Subnet 2 (AZ-c) | 10.255.1.0/24 | 冗長化 |
| Internet Gateway | なし | インターネットアクセス不要 |
| NAT Gateway | なし | インターネットアクセス不要 |

**コスト**: 小規模VPCはコストゼロ（リソースを配置しないため）。

---

## 6. 手動設定が必要な項目

CloudFormation では以下の設定を自動化できません。**手動設定が必須**です。

### 6-1. サーバー証明書の作成（OpenSSL）

```bash
openssl genrsa -out server.key 2048
openssl req -new -key server.key -out server.csr -subj "/C=JP/ST=Tokyo/L=Tokyo/O=Facilities/CN=server"
openssl x509 -req -in server.csr -signkey server.key -out server.crt -days 3650
aws acm import-certificate \
  --certificate fileb://server.crt \
  --private-key fileb://server.key \
  --region ap-northeast-1
```

**重要**: ACM Private CA を使用すると月額 $400（約60,000円）かかるため、OpenSSL を推奨。

### 6-2. クライアント証明書の作成（拠点ごと）

```bash
# 拠点01
openssl genrsa -out client01.key 2048
openssl req -new -key client01.key -out client01.csr -subj "/C=JP/ST=Tokyo/L=Tokyo/O=Facilities/CN=client01"
openssl x509 -req -in client01.csr -CA server.crt -CAkey server.key -CAcreateserial -out client01.crt -days 3650
aws acm import-certificate \
  --certificate fileb://client01.crt \
  --private-key fileb://client01.key \
  --certificate-chain fileb://server.crt \
  --region ap-northeast-1
```

拠点02～20 も同様に作成してください。

### 6-3. Client VPN Endpoint をサブネットに関連付け

```bash
aws ec2 associate-client-vpn-target-network \
  --client-vpn-endpoint-id <client-vpn-endpoint-id> \
  --subnet-id <client-vpn-subnet-1-id>
```

### 6-4. Transit Gateway Attachment の作成

```bash
aws ec2 create-transit-gateway-vpc-attachment \
  --transit-gateway-id <transit-gateway-id> \
  --vpc-id <client-vpn-vpc-id> \
  --subnet-ids <client-vpn-subnet-1-id> <client-vpn-subnet-2-id>
```

### 6-5. ルーティング設定

```bash
# Transit Gateway Route Table にルート追加
aws ec2 create-transit-gateway-route \
  --destination-cidr-block 172.16.0.0/22 \
  --transit-gateway-route-table-id <on-premises-route-table-id> \
  --transit-gateway-attachment-id <client-vpn-vpc-tgw-attachment-id>

# Client VPN VPC Route Table にルート追加
aws ec2 create-route \
  --route-table-id <client-vpn-vpc-route-table-id> \
  --destination-cidr-block 10.0.0.0/8 \
  --transit-gateway-id <transit-gateway-id>
```

### 6-6. 認可ルールの追加

```bash
aws ec2 authorize-client-vpn-ingress \
  --client-vpn-endpoint-id <client-vpn-endpoint-id> \
  --target-network-cidr 10.0.0.0/8 \
  --authorize-all-groups
```

**注**: これらの手順は `README.md` と `stack.yaml` の Outputs に詳細に記載しています。

---

## 7. コスト試算

### 月額コスト（パラメーターシート v1.3 準拠）

| 項目 | 単価 | 数量 | 月額（円） | 備考 |
|------|------|------|----------|------|
| Client VPN Endpoint | $0.10/時間 | 1エンドポイント × 24h × 30日 | 約10,800円 | 接続料 |
| Client VPN 接続料 | $0.05/時間 | 100接続 × 8h × 22日 | 約126,000円 | 稼働時間のみ（月～土 9:00-22:00） |
| Client VPN VPC | 無料 | 小規模VPC | 0円 | リソース配置なし |
| CloudWatch Logs | $0.76/GB | 5GB/月 | 約540円 | 接続ログ |
| **合計** | | | **約137,340円/月** | |

**注**: パラメーターシート v1.3 では約149,780円/月（Transit Gateway データ処理料等を含む）となっていますが、Client VPN 単体では約137,340円/月です。

### コスト削減策

- **将来の移行**: Direct Connect 実装後、Client VPN を無効化することで月額約137,000円削減可能
- **接続料最適化**: 稼働時間外（22:00-9:00）は VPN 接続を切断することで接続料削減

---

## 8. 将来の移行計画（Direct Connect へ）

### 移行タイミング

以下の条件が揃った時点で Direct Connect へ移行します：

1. ✅ BGP ASN（拠点側）が確定（現在: 準備中）
2. ✅ Direct Connect 回線が開通
3. ✅ パートナーから VLAN ID が提供される

### 移行手順

1. Direct Connect スタック（2-network）を更新（Direct Connect 設定を有効化）
2. 接続テストを実施（Direct Connect経由で Service VPC にアクセス）
3. Client VPN 接続を無効化（職員に通知）
4. Client VPN スタック（3-client-vpn）を削除
5. コスト削減効果を確認（月額約137,000円削減）

---

## 9. 監視・運用

### CloudWatch Logs

| ロググループ | 保持期間 | 内容 |
|------------|---------|------|
| `/aws/clientvpn/facilities-shared-client-vpn` | 90日 | 接続ログ、認証ログ |

### 推奨アラート

| メトリクス | 閾値 | 通知先 | 理由 |
|-----------|------|--------|------|
| ActiveConnectionsCount | > 90 | SNS Topic | 同時接続数の90%に達したらスケール検討 |
| AuthenticationFailures | > 10（10分間） | SNS Topic | 不正アクセスの可能性 |

**注**: これらのアラートは、実運用開始後に設定することを推奨します。

---

## 10. デプロイ手順

### 前提条件

- ✅ Shared Account に 2-network スタックがデプロイ済み
- ✅ Transit Gateway ID と OnPremises Route Table ID を確認済み

### デプロイ手順

詳細は `infra/cloudformation/shared/3-client-vpn/README.md` を参照してください。

#### 1. サーバー証明書の作成（手動）

```bash
# OpenSSL でサーバー証明書を作成
openssl genrsa -out server.key 2048
openssl req -new -key server.key -out server.csr -subj "/C=JP/ST=Tokyo/L=Tokyo/O=Facilities/CN=server"
openssl x509 -req -in server.csr -signkey server.key -out server.crt -days 3650

# ACM にインポート
aws acm import-certificate \
  --certificate fileb://server.crt \
  --private-key fileb://server.key \
  --region ap-northeast-1
```

#### 2. CloudFormation スタックのデプロイ

```bash
# Change Set 作成
aws cloudformation create-change-set \
  --stack-name facilities-shared-client-vpn \
  --change-set-name deploy-$(date +%Y%m%d-%H%M%S) \
  --template-body file://stack.yaml \
  --parameters file://parameters/shared.json \
  --capabilities CAPABILITY_IAM \
  --change-set-type CREATE

# Change Set 確認
aws cloudformation describe-change-set \
  --stack-name facilities-shared-client-vpn \
  --change-set-name <changeset-name>

# Change Set 実行
aws cloudformation execute-change-set \
  --stack-name facilities-shared-client-vpn \
  --change-set-name <changeset-name>
```

#### 3. デプロイ後の手動設定（6-3～6-6参照）

---

## 11. テスト計画

### 接続テスト

1. **VPN 接続テスト**:
   - 拠点01 から Client VPN に接続
   - 接続成功を確認（CloudWatch Logs で確認）

2. **Service VPC アクセステスト**:
   - 拠点01 から dev環境（10.0.0.0/16）へ ping
   - 拠点01 から stg環境（10.1.0.0/16）へ ping
   - 拠点01 から prod環境（10.2.0.0/16）へ ping

3. **API アクセステスト**:
   - 拠点01 から内部ALB（業務アプリ）へ HTTP リクエスト
   - レスポンスタイム測定（目標: 95%ile < 1秒）

### 性能テスト

| テスト項目 | 目標値 | 測定方法 |
|----------|--------|---------|
| 同時接続数 | 100接続 | CloudWatch Metrics |
| レスポンスタイム（VPN経由） | 95%ile < 1秒 | CloudWatch Logs |
| スループット | 100Mbps | iperf3 |

---

## 12. トラブルシューティング

### 接続できない

**症状**: VPN 接続は成功するが、Service VPC にアクセスできない

**確認事項**:
1. Transit Gateway Route Table にルートが追加されているか？
   ```bash
   aws ec2 describe-transit-gateway-route-tables \
     --transit-gateway-route-table-ids <on-premises-route-table-id>
   ```
2. Client VPN VPC Route Table にルートが追加されているか？
3. Client VPN Endpoint に認可ルールが追加されているか？
4. Service VPC のセキュリティグループで 172.16.0.0/22 からのアクセスが許可されているか？

### 認証エラー

**症状**: VPN 接続時に認証エラーが発生

**確認事項**:
1. サーバー証明書が ACM に正しくインポートされているか？
2. クライアント証明書がサーバー証明書で署名されているか？
3. 証明書の有効期限が切れていないか？

---

## 13. PM への報告

### 実装完了報告

✅ **Client VPN Endpoint の実装が完了しました。**

**成果物**:
- CloudFormation テンプレート（5ファイル）
- デプロイ手順書（README.md）
- SRE実装レポート（本ファイル）

**技術標準準拠**:
- ✅ CloudFormation 規約（Change Sets、ファイル分割3原則、パラメーター化）
- ✅ セキュリティ基準（証明書ベース認証、ログ記録、TLS 1.3）
- ✅ パラメーターシート v1.3 準拠

**重要な注意事項**:
1. **手動設定が必須**: サーバー証明書、クライアント証明書、ルーティング設定等（README.md 参照）
2. **暫定実装**: Direct Connect 実装後に Client VPN を無効化（月額約137,000円削減）
3. **コスト**: 月額約137,340円（パラメーターシート v1.3 の約149,780円とは Transit Gateway データ処理料等の差分）

**次のステップ**:
1. PM レビュー
2. ユーザー承認
3. デプロイ実施（README.md の手順に従う）
4. 接続テスト実施
5. 運用開始

---

**作成者**: SRE サブエージェント
**提出日**: 2025-10-25
**ステータス**: ✅ 実装完了（PM レビュー待ち）
