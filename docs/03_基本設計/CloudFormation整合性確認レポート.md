# CloudFormation 整合性確認レポート

**作成日**: 2025-10-29
**バージョン**: 1.0
**担当**: SRE エージェント
**ステータス**: レビュー待ち

---

## 1. エグゼクティブサマリー

### 1.1 確認対象

- **設計書**: `docs/03_基本設計/01_システム構成/システム構成設計書.md` (v1.2)
- **CloudFormation テンプレート**: `infra/cloudformation/` 配下の全ファイル
- **主な確認ポイント**: アカウント構成、VPC CIDR、接続方式、Transit Gateway Route Tables

### 1.2 結論

**総合評価**: ⚠️ **一部修正が必要**

| 項目 | 設計書との整合性 | 重要度 | 状態 |
|------|----------------|--------|------|
| アカウント構成（4アカウント） | ✅ 一致 | 高 | 問題なし |
| VPC CIDR（dev/stg/prod） | ✅ 一致 | 高 | 問題なし |
| 拠点接続方式（prod/stg: Direct Connect） | ✅ 一致 | 高 | 問題なし |
| 拠点接続方式（dev: Client VPN or Direct Connect） | ✅ 一致 | 高 | 問題なし |
| **開発会社用 Client VPN** | ❌ **未実装** | 高 | **要追加** |
| Transit Gateway Route Tables | ⚠️ 不完全 | 高 | 要拡張 |
| 環境別差分（dev: シングルAZ） | ✅ 一致 | 中 | 問題なし |
| RDS 構成（dev: シングルAZ / stg,prod: マルチAZ） | ✅ 一致（パラメーター） | 中 | 問題なし |

---

## 2. 詳細確認結果

### 2.1 アカウント構成

#### 設計書の定義（v1.2）

| アカウント | 役割 | VPC CIDR |
|----------|------|---------|
| Shared Account | ネットワークハブ・監査基盤 | - |
| Service Account (dev) | 開発環境 | 10.0.0.0/16 |
| Service Account (stg) | ステージング環境 | 10.1.0.0/16 |
| Service Account (prod) | 本番環境 | 10.2.0.0/16 |

#### CloudFormation の実装

**Shared Account**:
- `infra/cloudformation/shared/` - ✅ 実装済み

**Service Account (dev/stg/prod)**:
- `infra/cloudformation/service/parameters/dev.json` - VpcCidr: `10.0.0.0/16` ✅
- `infra/cloudformation/service/parameters/stg.json` - VpcCidr: `10.1.0.0/16` ✅
- `infra/cloudformation/service/parameters/prod.json` - VpcCidr: `10.2.0.0/16` ✅

**評価**: ✅ **完全一致**

---

### 2.2 接続方式

#### 2.2.1 拠点（職員）の接続

##### 設計書の定義（v1.2）

| 環境 | 接続方式 | 備考 |
|-----|---------|------|
| **prod** | Direct Connect | 本番運用 |
| **stg** | Direct Connect | prod と共有 |
| **dev** | **Client VPN または Direct Connect** | 回線契約の時期次第で変更 |

##### CloudFormation の実装

**Direct Connect（prod/stg 共有）**:
- `infra/cloudformation/shared/templates/network/direct-connect-gateway.yaml` - ✅ 実装済み
- `infra/cloudformation/shared/templates/network/transit-vif.yaml` - ✅ 実装済み

**Client VPN（拠点用、dev 専用）**:
- `infra/cloudformation/shared/templates/client-vpn/client-vpn-endpoint.yaml` - ✅ 実装済み
- Client CIDR: `172.16.0.0/22` ✅ 正しい

**評価**: ✅ **完全一致**

---

#### 2.2.2 開発会社の接続

##### 設計書の定義（v1.2）

| 環境 | 接続方式 | 備考 |
|-----|---------|------|
| **dev** | **Client VPN**（開発会社専用） | 開発・検証用アクセス |
| **stg** | **Client VPN**（開発会社専用） | 開発・検証用アクセス |
| **prod** | 検討中 | セキュリティ要件次第 |

##### CloudFormation の実装

**現状**: ❌ **開発会社用 Client VPN が未実装**

**問題点**:
1. 現在の Client VPN Endpoint は「拠点用（dev 専用）」のみ
2. 開発会社が dev/stg にアクセスするための Client VPN Endpoint が存在しない
3. 設計書では「開発会社専用」と明記されているが、実装されていない

**影響範囲**:
- 開発会社が dev/stg 環境にアクセスできない
- 開発・検証作業に支障をきたす可能性

**評価**: ❌ **不整合（要追加）**

---

### 2.3 Client VPN の整理（重要）

設計書（v1.2）によると、Client VPN Endpoint は**2つ**必要です：

#### 必要な Client VPN Endpoint

| Client VPN | 用途 | 対象環境 | Client CIDR | 状態 |
|-----------|------|---------|-------------|------|
| **Client VPN (拠点用)** | 拠点（職員100名）による閉域接続 | **dev のみ** | 172.16.0.0/22 | ✅ 実装済み |
| **Client VPN (開発会社用)** | 開発会社による開発・検証アクセス | **dev/stg** | **未定（例: 172.17.0.0/22）** | ❌ **未実装** |

#### 設計上の考慮事項

**Client CIDR の分離**:
- 拠点用: `172.16.0.0/22`（既存）
- 開発会社用: `172.17.0.0/22`（提案）または別の CIDR
- **理由**: 認証・認可の分離、ルーティングの明確化、セキュリティ監視の容易性

**Transit Gateway Route Tables との関係**:
- 拠点用 Client VPN → dev VPC のみ
- 開発会社用 Client VPN → dev VPC + stg VPC

---

### 2.4 Transit Gateway Route Tables

#### 設計書の定義（v1.2）

設計書には明示的な記載はありませんが、接続方式から推測される Route Tables:

| Route Table | 用途 | 必要なルート |
|------------|------|------------|
| **On-Premises Route Table** | 拠点 → Service VPC | - Direct Connect → prod VPC<br/>- Direct Connect → stg VPC<br/>- Client VPN (拠点用) → dev VPC<br/>- **Client VPN (開発会社用) → dev VPC + stg VPC** |
| **Service VPC Route Table** | Service VPC → 拠点 | - dev/stg/prod VPC → Direct Connect<br/>- dev/stg VPC → **Client VPN (開発会社用)** |

#### CloudFormation の実装

**現在の実装**:
```yaml
# infra/cloudformation/shared/templates/network/transit-gateway-route-tables.yaml

Resources:
  OnPremisesRouteTable:
    Type: AWS::EC2::TransitGatewayRouteTable
    Properties:
      TransitGatewayId: !Ref TransitGatewayId
      Tags:
        - Key: Name
          Value: tgw-rtb-on-premises
        - Key: Description
          Value: Route table for on-premises to Service VPC

  ServiceVpcRouteTable:
    Type: AWS::EC2::TransitGatewayRouteTable
    Properties:
      TransitGatewayId: !Ref TransitGatewayId
      Tags:
        - Key: Name
          Value: tgw-rtb-service-vpc
        - Key: Description
          Value: Route table for Service VPC to on-premises
```

**問題点**:
1. ✅ Route Table 自体は作成されている
2. ❌ 静的ルートが定義されていない（コメントで「Service Account デプロイ後に追加」と記載）
3. ⚠️ 開発会社用 Client VPN への対応が不明確

**評価**: ⚠️ **基本構造は OK、ルートの追加が必要**

---

### 2.5 環境別の差分

#### 設計書の定義（v1.2）

| 設定項目 | dev | stg | prod |
|---------|-----|-----|------|
| VPC CIDR | 10.0.0.0/16 | 10.1.0.0/16 | 10.2.0.0/16 |
| 拠点接続方式 | Client VPN or Direct Connect | Direct Connect | Direct Connect |
| 開発会社接続方式 | Client VPN | Client VPN | 検討中 |
| RDS 構成 | シングルAZ | マルチAZ | マルチAZ |
| ECS タスク数（最小） | 1 | 1 | 2 |
| ECS タスク数（最大） | 2 | 4 | 10 |

#### CloudFormation パラメーターの実装

**dev.json**:
```json
{
  "ParameterKey": "VpcCidr",
  "ParameterValue": "10.0.0.0/16"  // ✅ 正しい
},
{
  "ParameterKey": "StaffApiDesiredCount",
  "ParameterValue": "1"  // ✅ 正しい
},
{
  "ParameterKey": "DBInstanceClass",
  "ParameterValue": "db.t4g.micro"  // ✅ dev は小さいインスタンス
}
```

**stg.json**:
```json
{
  "ParameterKey": "VpcCidr",
  "ParameterValue": "10.1.0.0/16"  // ✅ 正しい
},
{
  "ParameterKey": "StaffApiDesiredCount",
  "ParameterValue": "2"  // ✅ 正しい（マルチAZ想定）
},
{
  "ParameterKey": "DBInstanceClass",
  "ParameterValue": "db.t4g.small"  // ✅ stg は中間スペック
}
```

**prod.json**:
```json
{
  "ParameterKey": "VpcCidr",
  "ParameterValue": "10.2.0.0/16"  // ✅ 正しい
},
{
  "ParameterKey": "StaffApiDesiredCount",
  "ParameterValue": "2"  // ✅ 正しい（マルチAZ）
},
{
  "ParameterKey": "DBInstanceClass",
  "ParameterValue": "db.t4g.medium"  // ✅ prod は大きいインスタンス
}
```

**評価**: ✅ **完全一致**

---

### 2.6 Service Account の Transit Gateway Attachment

#### CloudFormation の実装

**Service Account の Transit Gateway Attachment**:
```yaml
# infra/cloudformation/service/templates/network/transit-gateway-attachment.yaml

Parameters:
  TransitGatewayId:
    Type: String
    Description: Transit Gateway ID (from Shared Account)

Resources:
  TransitGatewayAttachment:
    Type: AWS::EC2::TransitGatewayAttachment
    Properties:
      TransitGatewayId: !Ref TransitGatewayId
      VpcId: !Ref VpcId
      SubnetIds: !If
        - CreateMultiAZ
        - - !Ref PrivateSubnet1Id
          - !Ref PrivateSubnet2Id
        - - !Ref PrivateSubnet1Id

  # 拠点への静的ルート（172.16.0.0/16）
  PrivateRoute1ToOnPremises:
    Type: AWS::EC2::Route
    DependsOn: TransitGatewayAttachment
    Properties:
      RouteTableId: !Ref PrivateRouteTable1Id
      DestinationCidrBlock: 172.16.0.0/16
      TransitGatewayId: !Ref TransitGatewayId
```

**問題点**:
1. ✅ Transit Gateway Attachment は正しく実装されている
2. ✅ 拠点 CIDR（172.16.0.0/16）への静的ルートは追加されている
3. ⚠️ **開発会社用 Client VPN の CIDR（172.17.0.0/22）へのルートが未定義**

**評価**: ⚠️ **基本構造は OK、開発会社用 Client VPN のルートが必要**

---

## 3. 不整合の詳細と修正提案

### 3.1 開発会社用 Client VPN Endpoint の追加（最重要）

#### 問題

設計書（v1.2）では以下のように定義されていますが、実装されていません：

| 環境 | 開発会社接続方式 |
|-----|---------------|
| dev | Client VPN（開発会社専用） |
| stg | Client VPN（開発会社専用） |
| prod | 検討中 |

#### 提案する修正内容

**1. 新規 Client VPN Endpoint の作成**

追加するファイル:
- `infra/cloudformation/shared/stacks/4-client-vpn-devcompany/stack.yaml`（新規）
- `infra/cloudformation/shared/stacks/4-client-vpn-devcompany/parameters/prod.json`（新規）

**設定値の提案**:
```yaml
Parameters:
  ClientCidrBlock: 172.17.0.0/22  # 拠点用と分離
  Description: Client VPN for Development Company (dev/stg access)
  SessionTimeoutHours: 8  # 拠点用より短い（業務時間のみ）
```

**2. Transit Gateway Route Tables の拡張**

追加するルート:
```yaml
# On-Premises Route Table に追加
- DestinationCidr: 10.0.0.0/16  # dev VPC
  TransitGatewayAttachmentId: <client-vpn-devcompany-attachment>

- DestinationCidr: 10.1.0.0/16  # stg VPC
  TransitGatewayAttachmentId: <client-vpn-devcompany-attachment>
```

**3. Service Account VPC Route Tables の拡張**

dev/stg の Private Route Table に追加:
```yaml
- DestinationCidrBlock: 172.17.0.0/22  # 開発会社用 Client VPN CIDR
  TransitGatewayId: !Ref TransitGatewayId
```

#### 実装の優先順位

| 優先度 | タスク | 理由 |
|-------|-------|------|
| **P0** | 開発会社用 Client VPN Endpoint 作成 | 開発・検証に必須 |
| **P1** | Transit Gateway Route Tables 拡張 | 接続のために必須 |
| **P2** | Service Account VPC Route Tables 拡張 | 双方向通信のために必須 |

---

### 3.2 Transit Gateway Route Tables の静的ルート追加

#### 問題

現在の `transit-gateway-route-tables.yaml` には以下のコメントがあります：

```yaml
# 注: Service VPC への静的ルートは Service Account デプロイ後に追加
# 拠点への静的ルートは Direct Connect Gateway Attachment 作成後に追加
```

これは**手動追加**を前提としていますが、自動化すべきです。

#### 提案する修正内容

**Option A: デプロイスクリプトで追加（推奨）**

`infra/cloudformation/shared/scripts/add-tgw-routes.sh`（新規作成）:
```bash
#!/bin/bash
set -euo pipefail

# 環境変数
TGW_ID="tgw-XXXXXXXXXXXX"
ON_PREMISES_RTB_ID="tgw-rtb-XXXXXXXXXXXX"
SERVICE_VPC_RTB_ID="tgw-rtb-XXXXXXXXXXXX"

# Service Account の Attachment ID を取得
DEV_ATTACHMENT_ID=$(aws ec2 describe-transit-gateway-attachments \
  --filters "Name=tag:Environment,Values=dev" \
  --query 'TransitGatewayAttachments[0].TransitGatewayAttachmentId' \
  --output text)

STG_ATTACHMENT_ID=$(aws ec2 describe-transit-gateway-attachments \
  --filters "Name=tag:Environment,Values=stg" \
  --query 'TransitGatewayAttachments[0].TransitGatewayAttachmentId' \
  --output text)

PROD_ATTACHMENT_ID=$(aws ec2 describe-transit-gateway-attachments \
  --filters "Name=tag:Environment,Values=prod" \
  --query 'TransitGatewayAttachments[0].TransitGatewayAttachmentId' \
  --output text)

# On-Premises Route Table にルート追加
echo "Adding routes to On-Premises Route Table..."
aws ec2 create-transit-gateway-route \
  --destination-cidr-block 10.0.0.0/16 \
  --transit-gateway-route-table-id "${ON_PREMISES_RTB_ID}" \
  --transit-gateway-attachment-id "${DEV_ATTACHMENT_ID}"

aws ec2 create-transit-gateway-route \
  --destination-cidr-block 10.1.0.0/16 \
  --transit-gateway-route-table-id "${ON_PREMISES_RTB_ID}" \
  --transit-gateway-attachment-id "${STG_ATTACHMENT_ID}"

aws ec2 create-transit-gateway-route \
  --destination-cidr-block 10.2.0.0/16 \
  --transit-gateway-route-table-id "${ON_PREMISES_RTB_ID}" \
  --transit-gateway-attachment-id "${PROD_ATTACHMENT_ID}"

echo "✅ Transit Gateway routes added successfully"
```

**Option B: CloudFormation カスタムリソースで追加**

Lambda-backed カスタムリソースで自動化。

---

### 3.3 設計書の表記と実装の整合性確認

#### 確認項目: Client VPN の用途表記

**設計書の表記**:
- 「拠点用 Client VPN（dev 専用）」
- 「開発会社用 Client VPN（dev/stg 専用）」

**CloudFormation の実装**:
- 拠点用のみ実装済み
- Description: `Facilities Shared Client VPN Endpoint (暫定実装、将来Direct Connectへ移行)`

**提案**:
Client VPN Endpoint の Description を明確化：
```yaml
# 拠点用
Description: "Client VPN for Branch Offices (dev only, temporary until Direct Connect is ready)"

# 開発会社用（新規）
Description: "Client VPN for Development Company (dev/stg access)"
```

---

## 4. 修正ファイル一覧

### 4.1 新規作成が必要なファイル

| ファイルパス | 内容 | 優先度 |
|-----------|------|-------|
| `infra/cloudformation/shared/stacks/4-client-vpn-devcompany/stack.yaml` | 開発会社用 Client VPN マスタースタック | **P0** |
| `infra/cloudformation/shared/stacks/4-client-vpn-devcompany/parameters/prod.json` | 開発会社用 Client VPN パラメーター | **P0** |
| `infra/cloudformation/shared/stacks/4-client-vpn-devcompany/README.md` | 開発会社用 Client VPN のドキュメント | P1 |
| `infra/cloudformation/shared/scripts/add-tgw-routes.sh` | Transit Gateway ルート追加スクリプト | P1 |

### 4.2 修正が必要なファイル

| ファイルパス | 修正内容 | 優先度 |
|-----------|---------|-------|
| `infra/cloudformation/service/templates/network/transit-gateway-attachment.yaml` | 開発会社用 Client VPN CIDR（172.17.0.0/22）へのルート追加 | P1 |
| `infra/cloudformation/shared/templates/client-vpn/client-vpn-endpoint.yaml` | Description の明確化（「拠点用」と明記） | P2 |

### 4.3 確認が必要なファイル

| ファイルパス | 確認内容 |
|-----------|---------|
| `docs/03_基本設計/02_ネットワーク/ネットワーク設計書.md` | 開発会社用 Client VPN の詳細を追記（現状記載なし） |
| `docs/03_基本設計/01_システム構成/システム構成設計書.md` | Mermaid 図に開発会社用 Client VPN を追加 |

---

## 5. 実装の推奨手順

### フェーズ1: 開発会社用 Client VPN の追加（必須）

**ステップ1**: 開発会社用 Client VPN Endpoint の作成
```bash
# 1. 新規スタックファイル作成
infra/cloudformation/shared/stacks/4-client-vpn-devcompany/stack.yaml

# 2. パラメーターファイル作成
infra/cloudformation/shared/stacks/4-client-vpn-devcompany/parameters/prod.json

# 3. デプロイ
./infra/cloudformation/shared/scripts/deploy-stack.sh 4-client-vpn-devcompany prod
```

**ステップ2**: Transit Gateway Route Tables の拡張
```bash
# 手動でルート追加（または自動化スクリプト実行）
./infra/cloudformation/shared/scripts/add-tgw-routes.sh
```

**ステップ3**: Service Account VPC Route Tables の拡張
```bash
# dev/stg の CloudFormation テンプレートを更新
# 開発会社用 Client VPN CIDR（172.17.0.0/22）へのルート追加
./infra/cloudformation/service/scripts/update-stack.sh dev
./infra/cloudformation/service/scripts/update-stack.sh stg
```

### フェーズ2: ドキュメントの更新

**ステップ1**: 設計書の更新
```bash
# ネットワーク設計書に開発会社用 Client VPN の詳細を追記
docs/03_基本設計/02_ネットワーク/ネットワーク設計書.md

# システム構成設計書の Mermaid 図を更新
docs/03_基本設計/01_システム構成/システム構成設計書.md
```

**ステップ2**: 運用ドキュメントの作成
```bash
# 開発会社用 Client VPN の運用手順書
docs/運用/開発会社用ClientVPN運用手順.md
```

---

## 6. リスクと影響範囲

### 6.1 開発会社用 Client VPN 未実装のリスク

| リスク | 影響 | 対策 |
|-------|------|------|
| 開発会社が dev/stg にアクセスできない | 開発・検証作業が進められない | 早急に実装 |
| 拠点用 Client VPN を流用すると認証・認可が不明確 | セキュリティリスク | 専用 Client VPN を作成 |
| 設計書と実装の乖離が拡大 | 運用・保守の混乱 | 設計書を更新 |

### 6.2 修正による影響範囲

| 影響範囲 | 詳細 |
|---------|------|
| **Shared Account** | 新規スタック追加（4-client-vpn-devcompany） |
| **Service Account (dev/stg)** | VPC Route Tables の更新 |
| **Transit Gateway** | Route Tables にルート追加 |
| **ドキュメント** | 設計書・運用手順書の更新 |

---

## 7. PM への報告

### 7.1 整合性確認の結果

**総合評価**: ⚠️ **一部修正が必要**

**主要な問題点**:
1. ❌ **開発会社用 Client VPN が未実装**（設計書には明記されているが、CloudFormation に存在しない）
2. ⚠️ Transit Gateway Route Tables に静的ルートが未定義（手動追加前提）
3. ✅ その他の項目（VPC CIDR、RDS 構成、環境別差分）は完全一致

### 7.2 推奨事項

**優先度 P0（緊急）**:
- 開発会社用 Client VPN Endpoint の作成
- Transit Gateway Route Tables の拡張

**優先度 P1（重要）**:
- Service Account VPC Route Tables の拡張
- Transit Gateway ルート追加スクリプトの作成

**優先度 P2（推奨）**:
- 設計書の更新（開発会社用 Client VPN の詳細記載）
- 運用ドキュメントの作成

### 7.3 次のアクションの提案

**PM への質問**:
1. 開発会社用 Client VPN の実装を進めてよいか？
2. 開発会社用 Client VPN の Client CIDR は `172.17.0.0/22` でよいか？
3. 開発会社の prod 環境へのアクセスは「検討中」だが、今回は実装しないという理解でよいか？

**実装の方針確認**:
- Transit Gateway Route Tables の静的ルートは手動追加か、自動化スクリプトで追加か？

---

## 8. 添付資料

### 8.1 開発会社用 Client VPN の設計案

**概要**:
```yaml
Name: facilities-shared-client-vpn-devcompany
ClientCidrBlock: 172.17.0.0/22
対象環境: dev/stg
接続方式: 証明書認証
SessionTimeout: 8時間（拠点用より短い）
```

**Transit Gateway Route Tables**:
```
On-Premises Route Table:
  - 172.17.0.0/22 → Client VPN VPC Attachment (開発会社用)

Service VPC Route Table:
  - 10.0.0.0/16 (dev) ← Client VPN Attachment (開発会社用)
  - 10.1.0.0/16 (stg) ← Client VPN Attachment (開発会社用)
```

**Service Account VPC Route Tables**:
```
dev Private Route Table:
  - 172.17.0.0/22 → Transit Gateway

stg Private Route Table:
  - 172.17.0.0/22 → Transit Gateway
```

### 8.2 推奨する Client CIDR の全体像

| 用途 | Client CIDR | 接続先 | 状態 |
|------|-------------|--------|------|
| 拠点（職員） | 172.16.0.0/22 | dev | ✅ 実装済み |
| 開発会社 | 172.17.0.0/22（提案） | dev/stg | ❌ 未実装 |
| 将来の拡張 | 172.18.0.0/22 | - | 予約 |

**理由**: /22 で 1,024 アドレス確保、将来の拡張にも対応可能

---

## 9. 結論

### 9.1 整合性確認の結論

CloudFormation テンプレートは、設計書（v1.2）の大部分を正しく実装していますが、以下の重要な項目が欠けています：

1. **開発会社用 Client VPN Endpoint**（未実装）
2. Transit Gateway Route Tables の静的ルート（手動追加前提）

### 9.2 推奨事項

**即座に対応すべき項目**:
- 開発会社用 Client VPN Endpoint の作成
- Transit Gateway Route Tables の拡張

**中期的に対応すべき項目**:
- Transit Gateway ルート追加の自動化
- 設計書の更新（開発会社用 Client VPN の詳細記載）

---

**作成者**: SRE エージェント
**最終更新**: 2025-10-29
**次のアクション**: PM レビュー待ち
