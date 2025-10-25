# Shared Account - 2-network Stack

**概要**: Transit Gateway と Direct Connect による拠点接続ネットワークハブ

**スタック名**: `facilities-shared-network`

---

## 📁 構成

### ディレクトリ構造

```
2-network/
├── README.md                           # このファイル
├── stack.yaml                          # マスタースタック（Nested Stacks統合）
├── parameters/
│   └── prod.json                       # パラメーターファイル
├── nested/
│   ├── transit-gateway.yaml            # Transit Gateway
│   ├── transit-gateway-route-tables.yaml # TGW Route Tables
│   ├── direct-connect-gateway.yaml     # Direct Connect Gateway
│   ├── transit-vif.yaml                # Transit Virtual Interface
│   └── ram-share.yaml                  # Resource Access Manager（TGW共有）
└── scripts/
    ├── validate.sh                     # テンプレート検証
    ├── create-changeset.sh             # Change Set 作成
    ├── describe-changeset.sh           # Change Set 確認（dry-run）
    ├── execute-changeset.sh            # Change Set 実行
    ├── rollback.sh                     # ロールバック
    └── deploy.sh                       # デプロイ（全ステップ実行）
```

### リソース構成

| Nested Stack | リソース | 用途 |
|-------------|---------|------|
| **transit-gateway** | Transit Gateway | ネットワークハブ（拠点 ⇔ Service VPC） |
| **transit-gateway-route-tables** | TGW Route Tables × 2 | ルーティング制御 |
| **direct-connect-gateway** | Direct Connect Gateway | 拠点接続（Direct Connect） |
| **transit-vif** | Transit Virtual Interface | BGP接続 |
| **ram-share** | Resource Share | Transit Gateway を Service Account に共有 |

---

## 🚀 デプロイ手順

### 前提条件

1. **AWS CLI 設定済み**
   - Shared Account の認証情報が設定されていること
   - 管理者権限（またはネットワーク作成権限）

2. **Service Account ID の確認**
   - `parameters/prod.json` の `ServiceAccountId` を実際の Service Account ID に変更

3. **Direct Connect Connection（オプション）**
   - パートナー（Equinix等）から Connection ID と VLAN ID を受け取っている場合のみ設定
   - 未受領の場合は、`DirectConnectConnectionId` を空にしておく（後で設定可能）

### ステップ 1: パラメーター設定

`parameters/prod.json` を編集：

```json
{
  "ParameterKey": "ServiceAccountId",
  "ParameterValue": "123456789012"  ← 実際の Service Account ID に変更
}
```

**Direct Connect が準備できている場合**:

```json
{
  "ParameterKey": "DirectConnectConnectionId",
  "ParameterValue": "dxcon-xxxxx"  ← パートナーから提供された Connection ID
},
{
  "ParameterKey": "VlanId",
  "ParameterValue": "100"  ← パートナーから提供された VLAN ID
},
{
  "ParameterKey": "BgpAuthKey",
  "ParameterValue": "your-bgp-md5-key"  ← BGP MD5 認証キー
}
```

### ステップ 2: テンプレート検証

```bash
cd infra/cloudformation/shared/2-network
./scripts/validate.sh
```

### ステップ 3: Change Set 作成（dry-run）

```bash
./scripts/create-changeset.sh
```

### ステップ 4: Change Set 確認

```bash
./scripts/describe-changeset.sh
```

**確認事項**:
- 作成されるリソースの種類
- 削除されるリソース（UPDATE の場合）
- リソースの置き換え（Replacement）の有無

### ステップ 5: Change Set 実行

```bash
./scripts/execute-changeset.sh
```

**注意**: 実行前に最終確認プロンプトが表示されます。

### 全ステップを一度に実行

```bash
./scripts/deploy.sh
```

---

## 🔄 Direct Connect 接続手順

### パートナーから Connection を受領する前

1. **Transit Gateway と Direct Connect Gateway のみデプロイ**
   - `DirectConnectConnectionId` を空にして実行
   - Transit Virtual Interface は作成されません（条件付きリソース）

### パートナーから Connection を受領した後

1. **パラメーター更新**
   - `parameters/prod.json` を編集
   - `DirectConnectConnectionId`, `VlanId`, `BgpAuthKey` を設定

2. **スタック更新**
   ```bash
   ./scripts/create-changeset.sh
   ./scripts/describe-changeset.sh
   ./scripts/execute-changeset.sh
   ```

3. **BGP セッション確認**
   - AWS コンソール → Direct Connect → Virtual interfaces
   - BGP Status が "Up" になることを確認

---

## 📊 デプロイ後の確認

### 1. Transit Gateway の確認

```bash
aws ec2 describe-transit-gateways \
  --filters Name=tag:Name,Values=facilities-tgw \
  --query 'TransitGateways[0].{ID:TransitGatewayId,State:State,ASN:Options.AmazonSideAsn}'
```

### 2. Transit Gateway Route Tables の確認

```bash
aws ec2 describe-transit-gateway-route-tables \
  --filters Name=tag:Name,Values=tgw-rtb-on-premises \
  --query 'TransitGatewayRouteTables[0].{ID:TransitGatewayRouteTableId,State:State}'
```

### 3. Direct Connect Gateway の確認

```bash
aws directconnect describe-direct-connect-gateways \
  --query 'directConnectGateways[?directConnectGatewayName==`facilities-dxgw`]'
```

### 4. Resource Share の確認

```bash
aws ram get-resource-shares \
  --resource-owner SELF \
  --query 'resourceShares[?name==`facilities-tgw-share`]'
```

### 5. Service Account での確認

Service Account に切り替えて実行：

```bash
aws ec2 describe-transit-gateways \
  --filters Name=owner-id,Values=<SharedAccountId> \
  --query 'TransitGateways[0].{ID:TransitGatewayId,OwnerID:OwnerId}'
```

**期待される結果**: Transit Gateway が表示されること（RAM 共有成功）

---

## 🛠️ トラブルシューティング

### Change Set 作成が失敗する

**エラー**: "Template format error"

**原因**: Nested Stack の TemplateURL が間違っている

**対処**:
1. `TemplateS3Bucket` パラメーターを空にする（ローカルファイル使用）
2. または、Nested テンプレートを S3 にアップロードして、S3 URL を使用

### Direct Connect Virtual Interface が "Down" のまま

**原因**: BGP セッションが確立していない

**対処**:
1. 拠点側ルーターの BGP 設定を確認
   - Neighbor IP: 169.254.1.1 (AWS側)
   - Local IP: 169.254.1.2 (拠点側)
   - ASN: 65000 (拠点側)
   - MD5 Auth: 設定した認証キー

2. AWS側の BGP 設定を確認
   - AWS コンソール → Direct Connect → Virtual interfaces
   - BGP Peer IP, ASN を確認

### Resource Share が Service Account に表示されない

**原因**: AWS Organizations が有効になっていない

**対処**:
1. Shared Account で AWS Organizations を有効化
2. Service Account を Organizations に追加
3. RAM の External Principals を有効化

---

## 🔧 メンテナンス

### スタック更新

```bash
# パラメーター変更後
./scripts/create-changeset.sh
./scripts/describe-changeset.sh
./scripts/execute-changeset.sh
```

### ロールバック

```bash
./scripts/rollback.sh
```

### スタック削除（注意）

⚠️ **警告**: Transit Gateway を削除すると、すべての Service VPC との接続が切断されます。

```bash
aws cloudformation delete-stack --stack-name facilities-shared-network
```

**削除保護**:
- Transit Gateway: `DeletionPolicy: Retain` 設定済み
- Direct Connect Gateway: `DeletionPolicy: Retain` 設定済み
- スタック削除時も、これらのリソースは残ります

---

## 📝 次のステップ

### Service Account での VPC Attachment 作成

Service Account で以下を実施：

1. **Transit Gateway Attachment 作成**
   - Service VPC を Transit Gateway にアタッチ
   - Private Subnet を指定

2. **ルートテーブル更新**
   - Private Subnet のルートテーブルに拠点向けルートを追加
   - Destination: 172.16.0.0/16
   - Target: Transit Gateway Attachment

3. **Transit Gateway Route Table にルート追加**
   - Shared Account に戻って実行
   - Service VPC 向けルートを追加

詳細は `docs/03_基本設計/02_ネットワーク設計.md` を参照。

---

## 🔍 参照ドキュメント

- **基本設計書**: `docs/03_基本設計/02_ネットワーク設計.md`（セクション2.7、2.8）
- **パラメーターシート**: `docs/03_基本設計/11_パラメーターシート.md`（セクション0.2～0.9）
- **技術標準**: `.claude/docs/40_standards/45_cloudformation.md`

---

**作成者**: SRE
**最終更新**: 2025-10-25
**スタック名**: facilities-shared-network
**AWS Account**: Shared Account
