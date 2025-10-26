# Client VPN Endpoint（暫定実装）

## 概要

このスタックは、**拠点からの VPN 接続を Transit Gateway 経由で全 Service VPC に振り分ける**ための Client VPN Endpoint を実装します。

**重要**: これは **暫定実装** です。将来、Direct Connect が実装されたら Client VPN を無効化します。

---

## アーキテクチャ

```
拠点（20拠点）
  ↓ AWS Client VPN（証明書ベース認証）
Client VPN Endpoint（Shared Account）
  ↓ Client VPN VPC（10.255.0.0/16）
Transit Gateway（Shared Account）
  ↓ TGW Attachments
Service VPC（dev/stg/prod: 10.0.0.0/16, 10.1.0.0/16, 10.2.0.0/16）
```

### なぜ Client VPN VPC が必要か？

Client VPN Endpoint は Transit Gateway に直接接続できません。そのため、以下の構成を採用しています：

1. **Client VPN VPC**（10.255.0.0/16）を Shared Account に作成
2. Client VPN Endpoint をこの VPC のサブネットに関連付け
3. この VPC から Transit Gateway への Attachment を作成
4. ルーティング設定

---

## スタック構成

### ネスト構成

```
3-client-vpn/
├── stack.yaml                               # 親スタック
└── templates/network/
    ├── client-vpn-vpc.yaml                  # Client VPN 用 VPC（10.255.0.0/16）
    ├── server-certificate.yaml              # サーバー証明書（手動作成手順）
    ├── client-vpn-endpoint.yaml             # Client VPN Endpoint
    └── transit-gateway-attachment.yaml      # TGW Attachment（手動作成手順）
```

### ライフサイクル

| リソース | 変更頻度 | 備考 |
|---------|---------|------|
| Client VPN VPC | 初回のみ | 将来削除予定 |
| Client VPN Endpoint | 初回のみ | 証明書更新時のみ変更 |
| Transit Gateway Attachment | 初回のみ | 手動作成 |

---

## デプロイ手順

### 前提条件

- Shared Account に 2-network スタックがデプロイ済み
- Transit Gateway ID と OnPremises Route Table ID を確認

### 1. サーバー証明書の作成（手動）

```bash
# 1. プライベートキーを生成
openssl genrsa -out server.key 2048

# 2. 証明書署名要求（CSR）を作成
openssl req -new -key server.key -out server.csr -subj "/C=JP/ST=Tokyo/L=Tokyo/O=Facilities/CN=server"

# 3. 自己署名証明書を生成（有効期限: 10年）
openssl x509 -req -in server.csr -signkey server.key -out server.crt -days 3650

# 4. ACM にインポート
aws acm import-certificate \
  --certificate fileb://server.crt \
  --private-key fileb://server.key \
  --region ap-northeast-1

# 5. ARN をメモ
# 例: arn:aws:acm:ap-northeast-1:123456789012:certificate/abcd-1234-efgh-5678
```

### 2. CloudFormation スタックのデプロイ

#### パラメーターファイル作成（parameters/shared.json）

```json
[
  {
    "ParameterKey": "TransitGatewayId",
    "ParameterValue": "tgw-XXXXXXXXXXXXXXXXX"
  },
  {
    "ParameterKey": "OnPremisesRouteTableId",
    "ParameterValue": "tgw-rtb-XXXXXXXXXXXXXXXXX"
  },
  {
    "ParameterKey": "ServerCertificateArn",
    "ParameterValue": "arn:aws:acm:ap-northeast-1:123456789012:certificate/abcd-1234-efgh-5678"
  },
  {
    "ParameterKey": "ClientCidrBlock",
    "ParameterValue": "172.16.0.0/22"
  },
  {
    "ParameterKey": "SplitTunnel",
    "ParameterValue": "true"
  },
  {
    "ParameterKey": "SessionTimeoutHours",
    "ParameterValue": "12"
  },
  {
    "ParameterKey": "CloudWatchLogGroupRetentionDays",
    "ParameterValue": "90"
  }
]
```

#### デプロイコマンド

```bash
# 1. Change Set 作成
aws cloudformation create-change-set \
  --stack-name facilities-shared-client-vpn \
  --change-set-name deploy-$(date +%Y%m%d-%H%M%S) \
  --template-body file://stack.yaml \
  --parameters file://parameters/shared.json \
  --capabilities CAPABILITY_IAM \
  --change-set-type CREATE

# 2. Change Set 確認
aws cloudformation describe-change-set \
  --stack-name facilities-shared-client-vpn \
  --change-set-name <changeset-name>

# 3. Change Set 実行
aws cloudformation execute-change-set \
  --stack-name facilities-shared-client-vpn \
  --change-set-name <changeset-name>

# 4. デプロイ完了待機
aws cloudformation wait stack-create-complete \
  --stack-name facilities-shared-client-vpn
```

### 3. デプロイ後の手動設定

#### 3-1. クライアント証明書の作成（拠点ごと）

```bash
# 拠点01 のクライアント証明書
openssl genrsa -out client01.key 2048
openssl req -new -key client01.key -out client01.csr -subj "/C=JP/ST=Tokyo/L=Tokyo/O=Facilities/CN=client01"
openssl x509 -req -in client01.csr -CA server.crt -CAkey server.key -CAcreateserial -out client01.crt -days 3650

# ACM にインポート
aws acm import-certificate \
  --certificate fileb://client01.crt \
  --private-key fileb://client01.key \
  --certificate-chain fileb://server.crt \
  --region ap-northeast-1

# 拠点02～20 も同様に作成
```

#### 3-2. Client VPN Endpoint をサブネットに関連付け

```bash
# スタック出力から取得
CLIENT_VPN_ENDPOINT_ID=$(aws cloudformation describe-stacks \
  --stack-name facilities-shared-client-vpn \
  --query 'Stacks[0].Outputs[?OutputKey==`ClientVpnEndpointId`].OutputValue' \
  --output text)

CLIENT_VPN_SUBNET_1_ID=$(aws cloudformation describe-stacks \
  --stack-name facilities-shared-client-vpn \
  --query 'Stacks[0].Outputs[?OutputKey==`ClientVpnSubnet1Id`].OutputValue' \
  --output text)

# サブネットに関連付け
aws ec2 associate-client-vpn-target-network \
  --client-vpn-endpoint-id ${CLIENT_VPN_ENDPOINT_ID} \
  --subnet-id ${CLIENT_VPN_SUBNET_1_ID}
```

#### 3-3. Client VPN VPC から Transit Gateway への Attachment 作成

```bash
# スタック出力から取得
CLIENT_VPN_VPC_ID=$(aws cloudformation describe-stacks \
  --stack-name facilities-shared-client-vpn \
  --query 'Stacks[0].Outputs[?OutputKey==`ClientVpnVpcId`].OutputValue' \
  --output text)

CLIENT_VPN_SUBNET_2_ID=$(aws cloudformation describe-stacks \
  --stack-name facilities-shared-client-vpn \
  --query 'Stacks[0].Outputs[?OutputKey==`ClientVpnSubnet2Id`].OutputValue' \
  --output text)

TRANSIT_GATEWAY_ID=$(aws cloudformation describe-stacks \
  --stack-name facilities-shared-network \
  --query 'Stacks[0].Outputs[?OutputKey==`TransitGatewayId`].OutputValue' \
  --output text)

# Transit Gateway Attachment 作成
aws ec2 create-transit-gateway-vpc-attachment \
  --transit-gateway-id ${TRANSIT_GATEWAY_ID} \
  --vpc-id ${CLIENT_VPN_VPC_ID} \
  --subnet-ids ${CLIENT_VPN_SUBNET_1_ID} ${CLIENT_VPN_SUBNET_2_ID} \
  --tag-specifications 'ResourceType=transit-gateway-attachment,Tags=[{Key=Name,Value=facilities-shared-client-vpn-tgw-attach}]'
```

#### 3-4. Transit Gateway Route Table にルートを追加

```bash
# スタック出力から取得
ON_PREMISES_ROUTE_TABLE_ID=$(aws cloudformation describe-stacks \
  --stack-name facilities-shared-network \
  --query 'Stacks[0].Outputs[?OutputKey==`OnPremisesRouteTableId`].OutputValue' \
  --output text)

CLIENT_VPN_VPC_TGW_ATTACHMENT_ID=$(aws ec2 describe-transit-gateway-vpc-attachments \
  --filters "Name=vpc-id,Values=${CLIENT_VPN_VPC_ID}" \
  --query 'TransitGatewayVpcAttachments[0].TransitGatewayAttachmentId' \
  --output text)

# Client VPN CIDR (172.16.0.0/22) へのルート追加
aws ec2 create-transit-gateway-route \
  --destination-cidr-block 172.16.0.0/22 \
  --transit-gateway-route-table-id ${ON_PREMISES_ROUTE_TABLE_ID} \
  --transit-gateway-attachment-id ${CLIENT_VPN_VPC_TGW_ATTACHMENT_ID}
```

#### 3-5. Client VPN VPC Route Table にルートを追加

```bash
# Client VPN VPC の Route Table ID を取得
CLIENT_VPN_ROUTE_TABLE_ID=$(aws ec2 describe-route-tables \
  --filters "Name=vpc-id,Values=${CLIENT_VPN_VPC_ID}" \
  --query 'RouteTables[0].RouteTableId' \
  --output text)

# Service VPC (dev/stg/prod: 10.0.0.0/8) へのルート追加
aws ec2 create-route \
  --route-table-id ${CLIENT_VPN_ROUTE_TABLE_ID} \
  --destination-cidr-block 10.0.0.0/8 \
  --transit-gateway-id ${TRANSIT_GATEWAY_ID}
```

#### 3-6. Client VPN Endpoint に認可ルールを追加

```bash
# Service VPC (10.0.0.0/8) へのアクセス許可
aws ec2 authorize-client-vpn-ingress \
  --client-vpn-endpoint-id ${CLIENT_VPN_ENDPOINT_ID} \
  --target-network-cidr 10.0.0.0/8 \
  --authorize-all-groups
```

---

## 接続テスト

### VPN クライアント設定ファイルのダウンロード

1. AWS Console にログイン
2. VPC → Client VPN Endpoints → `facilities-shared-client-vpn`
3. "Download Client Configuration" をクリック
4. ダウンロードした `.ovpn` ファイルにクライアント証明書を追加:

```xml
<cert>
-----BEGIN CERTIFICATE-----
（client01.crt の内容）
-----END CERTIFICATE-----
</cert>
<key>
-----BEGIN PRIVATE KEY-----
（client01.key の内容）
-----END PRIVATE KEY-----
</key>
```

### OpenVPN クライアントで接続

```bash
# Linux/macOS
sudo openvpn --config client-config.ovpn

# Windows
# OpenVPN GUI を使用
```

### 接続確認

```bash
# Service VPC（dev環境）への接続確認
ping 10.0.2.10

# curl で API 確認（ALB経由）
curl http://internal-facilities-staff-alb-xxxxxxxxx.ap-northeast-1.elb.amazonaws.com/health
```

---

## 監視・ログ

### CloudWatch Logs

- **ロググループ**: `/aws/clientvpn/facilities-shared-client-vpn`
- **保持期間**: 90日
- **内容**: 接続ログ、認証ログ

### CloudWatch Metrics

| メトリクス | 閾値 | 通知先 |
|-----------|------|--------|
| ActiveConnectionsCount | > 90（同時接続数の90%） | SNS Topic |
| AuthenticationFailures | > 10（10分間） | SNS Topic |

---

## コスト試算

| 項目 | 単価 | 数量 | 月額（円） |
|------|------|------|----------|
| Client VPN Endpoint | $0.10/時間 | 1エンドポイント × 24h × 30日 | 約10,800円 |
| Client VPN 接続料 | $0.05/時間 | 100接続 × 8h × 22日 | 約126,000円 |
| Client VPN VPC | 無料 | 小規模VPCはコストゼロ | 0円 |
| CloudWatch Logs | $0.76/GB | 5GB/月 | 約540円 |
| **合計** | | | **約137,340円/月** |

**注**: Direct Connect 実装後は Client VPN を無効化し、コスト削減します。

---

## 将来の移行計画（Direct Connect へ）

### 移行タイミング

- BGP ASN（拠点側）が確定した後
- Direct Connect 回線が開通した後

### 移行手順

1. Direct Connect スタック（2-network）をデプロイ
2. 接続テストを実施（Direct Connect経由）
3. Client VPN 接続を無効化
4. Client VPN スタックを削除

---

## トラブルシューティング

### 接続できない

**症状**: VPN 接続は成功するが、Service VPC にアクセスできない

**確認事項**:
1. Transit Gateway Route Table にルートが追加されているか？
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

**作成者**: SRE サブエージェント
**最終更新**: 2025-10-25
