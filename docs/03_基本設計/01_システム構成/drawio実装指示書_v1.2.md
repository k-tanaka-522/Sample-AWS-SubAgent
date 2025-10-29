# drawio 実装指示書（マルチアカウント全体構成図）

**作成日**: 2025-10-29
**バージョン**: 1.2
**対象図**: マルチアカウント全体構成図（4アカウント構成）

**更新履歴**:
- v1.2 (2025-10-29): **重要な修正** - アカウント構成を4つに修正（Shared + dev/stg/prod）、接続方式の環境別差分を明記
- v1.1 (2025-10-25): マルチアカウント構成対応
- v1.0 (2025-10-25): 初版作成

---

## 1. 概要

この指示書は、**4アカウント構成（Shared Account + Service Account (dev/stg/prod)）** のマルチアカウントシステム全体構成図を draw.io で作成するための詳細な手順を記載しています。

### 重要な設計原則

1. **4つのアカウントを明確に区別**
   - Shared Account（共有基盤）
   - Service Account (dev)（開発環境専用アカウント）
   - Service Account (stg)（ステージング環境専用アカウント）
   - Service Account (prod)（本番環境専用アカウント）

2. **接続方式の環境別差分を視覚的に表現**
   - **prod/stg**: Direct Connect（実線、太線、オレンジ色）
   - **dev**: Client VPN（点線、太線、オレンジ色）

3. **構築順序の明確化**
   - まず本番（prod）を構築
   - その構成を3環境（dev/stg/prod）に展開
   - 接続方式のみ環境別に差分

---

## 2. キャンバス設定

### キャンバスサイズ
- **幅**: 1400px
- **高さ**: 2000px
- **向き**: 縦（Portrait）
- **グリッド**: 10px

---

## 3. レイアウト設計

### 全体レイアウト（縦配置）

```
┌────────────────────────────────────────────────────┐
│  拠点（20拠点）                                      │
│  - 各拠点100台の端末                                 │
│  - 合計2,000台                                      │
└────────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────────┐
│  Shared Account（共有基盤）                          │
│  ┌──────────────────────────────────────────────┐  │
│  │  Direct Connect（prod/stg 共有）              │  │
│  │  - Direct Connect (100Mbps)                  │  │
│  │  - Direct Connect Gateway                    │  │
│  │  - Transit VIF                               │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │  Client VPN（dev 専用）                       │  │
│  │  - Client VPN Endpoint                       │  │
│  │  - コスト削減のため                            │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │  Transit Gateway（すべての環境のハブ）          │  │
│  │  - ネットワークハブ                            │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │  監査・セキュリティ                             │  │
│  │  - CloudTrail、Config、GuardDuty、Security Hub │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │  AWS Organizations（管理アカウント）            │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
         ↓（Direct Connect 実線）  ↓（Client VPN 点線）
┌────────────────────────────────────────────────────┐
│  Service Account (dev)（開発環境専用アカウント）      │
│  - VPC (10.0.0.0/16)                               │
│  - Client VPN 経由（コスト削減）                     │
│  - RDS シングルAZ                                   │
└────────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────────┐
│  Service Account (stg)（ステージング環境専用アカウント）│
│  - VPC (10.1.0.0/16)                               │
│  - Direct Connect 経由（本番共有）                   │
│  - RDS マルチAZ                                     │
└────────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────────┐
│  Service Account (prod)（本番環境専用アカウント）     │
│  - VPC (10.2.0.0/16)                               │
│  - Direct Connect 経由（本番運用）                   │
│  - RDS マルチAZ                                     │
└────────────────────────────────────────────────────┘
```

---

## 4. コンポーネント配置（上から下へ）

### 4.1 拠点（オンプレミス）

**位置**: 最上部（Y: 50px）
**サイズ**: 幅300px × 高さ100px

#### 拠点ボックス
- **図形**: 長方形（角丸）
- **塗りつぶし**: `#FFF3E6`（薄いオレンジ）
- **枠線**: `#FF9800`（オレンジ）、太さ2px
- **テキスト**:
  ```
  拠点（20拠点）
  各拠点100台の端末
  合計2,000台
  ```
- **フォント**: Arial、14pt、Bold

---

### 4.2 Shared Account（共有基盤）

**位置**: 拠点の下（Y: 200px）
**サイズ**: 幅1200px × 高さ600px

#### Shared Account 外枠
- **図形**: 長方形（角丸）
- **塗りつぶし**: `#E6F3FF`（薄い青）
- **枠線**: `#2196F3`（青）、太さ3px
- **ラベル**: 「Shared Account（共有基盤）」
- **フォント**: Arial、16pt、Bold

#### 4.2.1 Direct Connect セクション（prod/stg 共有）

**位置**: Shared Account 内左上（X: 50px, Y: 250px）
**サイズ**: 幅500px × 高さ150px

- **図形**: 長方形（角丸）
- **塗りつぶし**: `#FFE6CC`（薄いオレンジ）
- **枠線**: `#FF6600`（オレンジ）、太さ3px
- **ラベル**: 「Direct Connect 接続（prod/stg 共有）」
- **フォント**: Arial、14pt、Bold

##### コンポーネント（横並び）

1. **Direct Connect**
   - **アイコン**: AWS Direct Connect アイコン
   - **テキスト**:
     ```
     Direct Connect
     100Mbps
     Hosted Connection
     ```
   - **位置**: X: 80px, Y: 280px

2. **Direct Connect Gateway**
   - **アイコン**: AWS Direct Connect Gateway アイコン
   - **テキスト**:
     ```
     Direct Connect
     Gateway
     ```
   - **位置**: X: 230px, Y: 280px

3. **Transit VIF**
   - **アイコン**: AWS Virtual Interface アイコン
   - **テキスト**:
     ```
     Transit VIF
     (プライベート)
     ```
   - **位置**: X: 380px, Y: 280px

##### 接続線（コンポーネント間）
- **Direct Connect → Transit VIF**: 実線、オレンジ（`#FF6600`）、太さ2px
- **Transit VIF → Direct Connect Gateway**: 実線、オレンジ（`#FF6600`）、太さ2px

#### 4.2.2 Client VPN セクション（dev 専用）

**位置**: Shared Account 内右上（X: 600px, Y: 250px）
**サイズ**: 幅500px × 高さ150px

- **図形**: 長方形（角丸）
- **塗りつぶし**: `#E6F7FF`（薄い青）
- **枠線**: `#0066FF`（青）、太さ3px、**点線**
- **ラベル**: 「Client VPN（dev 専用）」
- **フォント**: Arial、14pt、Bold

##### コンポーネント

1. **Client VPN Endpoint**
   - **アイコン**: AWS Client VPN アイコン
   - **テキスト**:
     ```
     Client VPN
     Endpoint
     ```
   - **位置**: X: 750px, Y: 280px

2. **注釈**
   - **テキスト**: 「コスト削減のため」
   - **位置**: X: 750px, Y: 350px
   - **フォント**: Arial、12pt、Italic
   - **色**: `#0066FF`（青）

#### 4.2.3 Transit Gateway セクション

**位置**: Shared Account 内中央（X: 450px, Y: 450px）
**サイズ**: 幅300px × 高さ80px

- **図形**: 長方形（角丸）
- **塗りつぶし**: `#FFF9E6`（薄い黄色）
- **枠線**: `#FFC107`（黄色）、太さ2px
- **ラベル**: 「Transit Gateway（すべての環境のハブ）」
- **フォント**: Arial、14pt、Bold

##### コンポーネント

1. **Transit Gateway**
   - **アイコン**: AWS Transit Gateway アイコン
   - **テキスト**:
     ```
     TGW
     ネットワークハブ
     ```
   - **位置**: X: 550px, Y: 480px

#### 4.2.4 監査・セキュリティセクション

**位置**: Shared Account 内下部左（X: 50px, Y: 580px）
**サイズ**: 幅500px × 高さ150px

- **図形**: 長方形（角丸）
- **塗りつぶし**: `#F3E5F5`（薄い紫）
- **枠線**: `#9C27B0`（紫）、太さ2px
- **ラベル**: 「監査・セキュリティ」
- **フォント**: Arial、14pt、Bold

##### コンポーネント（2×2グリッド）

1. **CloudTrail**（左上）
   - **アイコン**: AWS CloudTrail アイコン
   - **テキスト**:
     ```
     CloudTrail
     (組織全体)
     ```
   - **位置**: X: 100px, Y: 610px

2. **Config**（右上）
   - **アイコン**: AWS Config アイコン
   - **テキスト**:
     ```
     Config
     (組織全体)
     ```
   - **位置**: X: 300px, Y: 610px

3. **GuardDuty**（左下）
   - **アイコン**: AWS GuardDuty アイコン
   - **テキスト**:
     ```
     GuardDuty
     (組織全体)
     ```
   - **位置**: X: 100px, Y: 680px

4. **Security Hub**（右下）
   - **アイコン**: AWS Security Hub アイコン
   - **テキスト**:
     ```
     Security Hub
     (組織全体)
     ```
   - **位置**: X: 300px, Y: 680px

#### 4.2.5 AWS Organizations セクション

**位置**: Shared Account 内下部右（X: 600px, Y: 580px）
**サイズ**: 幅500px × 高さ150px

- **図形**: 長方形（角丸）
- **塗りつぶし**: `#E8F5E9`（薄い緑）
- **枠線**: `#4CAF50`（緑）、太さ2px
- **ラベル**: 「AWS Organizations」
- **フォント**: Arial、14pt、Bold

##### コンポーネント

1. **Organizations**
   - **アイコン**: AWS Organizations アイコン
   - **テキスト**:
     ```
     Organizations
     (管理アカウント)
     ```
   - **位置**: X: 750px, Y: 650px

---

### 4.3 Service Account (dev)（開発環境専用アカウント）

**位置**: Shared Account の下（Y: 850px）
**サイズ**: 幅1200px × 高さ300px

#### Service Account (dev) 外枠
- **図形**: 長方形（角丸）
- **塗りつぶし**: `#E6FFE6`（薄い緑）
- **枠線**: `#4CAF50`（緑）、太さ3px、**点線**
- **ラベル**: 「Service Account (dev) - 開発環境専用アカウント」
- **フォント**: Arial、16pt、Bold

#### VPC セクション（VPC 10.0.0.0/16）

**位置**: Service Account (dev) 内（X: 50px, Y: 900px）
**サイズ**: 幅1100px × 高さ200px

- **図形**: 長方形（角丸）
- **塗りつぶし**: `#F0F8FF`（薄い青）
- **枠線**: `#2196F3`（青）、太さ2px
- **ラベル**: 「VPC (10.0.0.0/16)」
- **フォント**: Arial、14pt、Bold

##### コンポーネント（横並び）

1. **Transit Gateway Attachment**（左）
   - **アイコン**: AWS Transit Gateway Attachment アイコン
   - **テキスト**:
     ```
     Transit Gateway
     Attachment
     ```
   - **位置**: X: 100px, Y: 950px

2. **Public Subnet**（中央左）
   - **図形**: 長方形（角丸）
   - **塗りつぶし**: `#E8F5E9`（薄い緑）
   - **枠線**: `#4CAF50`（緑）、太さ1px
   - **ラベル**: 「Public Subnet」
   - **コンポーネント**:
     - ALB（業務アプリ - 内部）
     - ALB（事業者アプリ - パブリック）
     - NAT Gateway
   - **位置**: X: 300px, Y: 950px

3. **Private Subnet**（中央右）
   - **図形**: 長方形（角丸）
   - **塗りつぶし**: `#FFF9E6`（薄い黄色）
   - **枠線**: `#FFC107`（黄色）、太さ1px
   - **ラベル**: 「Private Subnet」
   - **コンポーネント**:
     - ECS Fargate（業務API）
     - ECS Fargate（事業者API）
     - ECS Fargate（バッチ）
   - **位置**: X: 600px, Y: 950px

4. **DB Subnet**（右）
   - **図形**: 長方形（角丸）
   - **塗りつぶし**: `#FFE6E6`（薄い赤）
   - **枠線**: `#F44336`（赤）、太さ1px
   - **ラベル**: 「DB Subnet」
   - **コンポーネント**:
     - RDS PostgreSQL（シングルAZ）
   - **位置**: X: 900px, Y: 950px

---

### 4.4 Service Account (stg)（ステージング環境専用アカウント）

**位置**: Service Account (dev) の下（Y: 1200px）
**サイズ**: 幅1200px × 高さ300px

#### Service Account (stg) 外枠
- **図形**: 長方形（角丸）
- **塗りつぶし**: `#FFE6CC`（薄いオレンジ）
- **枠線**: `#FF9800`（オレンジ）、太さ3px
- **ラベル**: 「Service Account (stg) - ステージング環境専用アカウント」
- **フォント**: Arial、16pt、Bold

#### VPC セクション（VPC 10.1.0.0/16）

**位置**: Service Account (stg) 内（X: 50px, Y: 1250px）
**サイズ**: 幅1100px × 高さ200px

- **図形**: 長方形（角丸）
- **塗りつぶし**: `#F0F8FF`（薄い青）
- **枠線**: `#2196F3`（青）、太さ2px
- **ラベル**: 「VPC (10.1.0.0/16)」
- **フォント**: Arial、14pt、Bold

##### コンポーネント（横並び）

1. **Transit Gateway Attachment**（左）
   - **アイコン**: AWS Transit Gateway Attachment アイコン
   - **テキスト**:
     ```
     Transit Gateway
     Attachment
     ```
   - **位置**: X: 100px, Y: 1300px

2. **Public Subnet**（中央左）
   - **図形**: 長方形（角丸）
   - **塗りつぶし**: `#E8F5E9`（薄い緑）
   - **枠線**: `#4CAF50`（緑）、太さ1px
   - **ラベル**: 「Public Subnet」
   - **コンポーネント**:
     - ALB（業務アプリ - 内部）
     - ALB（事業者アプリ - パブリック）
     - NAT Gateway
   - **位置**: X: 300px, Y: 1300px

3. **Private Subnet**（中央右）
   - **図形**: 長方形（角丸）
   - **塗りつぶし**: `#FFF9E6`（薄い黄色）
   - **枠線**: `#FFC107`（黄色）、太さ1px
   - **ラベル**: 「Private Subnet」
   - **コンポーネント**:
     - ECS Fargate（業務API）
     - ECS Fargate（事業者API）
     - ECS Fargate（バッチ）
   - **位置**: X: 600px, Y: 1300px

4. **DB Subnet**（右）
   - **図形**: 長方形（角丸）
   - **塗りつぶし**: `#FFE6E6`（薄い赤）
   - **枠線**: `#F44336`（赤）、太さ1px
   - **ラベル**: 「DB Subnet」
   - **コンポーネント**:
     - RDS PostgreSQL（マルチAZ）
   - **位置**: X: 900px, Y: 1300px

---

### 4.5 Service Account (prod)（本番環境専用アカウント）

**位置**: Service Account (stg) の下（Y: 1550px）
**サイズ**: 幅1200px × 高さ300px

#### Service Account (prod) 外枠
- **図形**: 長方形（角丸）
- **塗りつぶし**: `#FFE6E6`（薄い赤）
- **枠線**: `#F44336`（赤）、太さ3px
- **ラベル**: 「Service Account (prod) - 本番環境専用アカウント」
- **フォント**: Arial、16pt、Bold

#### VPC セクション（VPC 10.2.0.0/16）

**位置**: Service Account (prod) 内（X: 50px, Y: 1600px）
**サイズ**: 幅1100px × 高さ200px

- **図形**: 長方形（角丸）
- **塗りつぶし**: `#F0F8FF`（薄い青）
- **枠線**: `#2196F3`（青）、太さ2px
- **ラベル**: 「VPC (10.2.0.0/16)」
- **フォント**: Arial、14pt、Bold

##### コンポーネント（横並び）

1. **Transit Gateway Attachment**（左）
   - **アイコン**: AWS Transit Gateway Attachment アイコン
   - **テキスト**:
     ```
     Transit Gateway
     Attachment
     ```
   - **位置**: X: 100px, Y: 1650px

2. **Public Subnet**（中央左）
   - **図形**: 長方形（角丸）
   - **塗りつぶし**: `#E8F5E9`（薄い緑）
   - **枠線**: `#4CAF50`（緑）、太さ1px
   - **ラベル**: 「Public Subnet」
   - **コンポーネント**:
     - ALB（業務アプリ - 内部）
     - ALB（事業者アプリ - パブリック）
     - NAT Gateway
   - **位置**: X: 300px, Y: 1650px

3. **Private Subnet**（中央右）
   - **図形**: 長方形（角丸）
   - **塗りつぶし**: `#FFF9E6`（薄い黄色）
   - **枠線**: `#FFC107`（黄色）、太さ1px
   - **ラベル**: 「Private Subnet」
   - **コンポーネント**:
     - ECS Fargate（業務API）
     - ECS Fargate（事業者API）
     - ECS Fargate（バッチ）
   - **位置**: X: 600px, Y: 1650px

4. **DB Subnet**（右）
   - **図形**: 長方形（角丸）
   - **塗りつぶし**: `#FFE6E6`（薄い赤）
   - **枠線**: `#F44336`（赤）、太さ1px
   - **ラベル**: 「DB Subnet」
   - **コンポーネント**:
     - RDS PostgreSQL（マルチAZ）
   - **位置**: X: 900px, Y: 1650px

---

## 5. データフロー（接続線）

### 5.1 Direct Connect フロー（prod/stg）

#### 拠点 → Direct Connect → Transit Gateway → stg/prod VPC

1. **拠点 → Direct Connect**
   - **種類**: 実線、太線（太さ4px）
   - **色**: `#FF6600`（オレンジ）
   - **ラベル**: 「BGP ピアリング」
   - **始点**: 拠点ボックス下部中央
   - **終点**: Direct Connect アイコン上部

2. **Direct Connect → Transit VIF**
   - **種類**: 実線、太線（太さ3px）
   - **色**: `#FF6600`（オレンジ）
   - **始点**: Direct Connect アイコン右側
   - **終点**: Transit VIF アイコン左側

3. **Transit VIF → Direct Connect Gateway**
   - **種類**: 実線、太線（太さ3px）
   - **色**: `#FF6600`（オレンジ）
   - **始点**: Transit VIF アイコン右側
   - **終点**: Direct Connect Gateway アイコン左側

4. **Direct Connect Gateway → Transit Gateway**
   - **種類**: 実線、太線（太さ3px）
   - **色**: `#FF6600`（オレンジ）
   - **始点**: Direct Connect Gateway アイコン下部
   - **終点**: Transit Gateway アイコン上部

5. **Transit Gateway → stg VPC（Transit Gateway Attachment）**
   - **種類**: 実線、太線（太さ4px）
   - **色**: `#FF6600`（オレンジ）
   - **ラベル**: 「Direct Connect 経由（本番共有）」
   - **始点**: Transit Gateway アイコン下部
   - **終点**: Service Account (stg) の Transit Gateway Attachment 上部

6. **Transit Gateway → prod VPC（Transit Gateway Attachment）**
   - **種類**: 実線、太線（太さ4px）
   - **色**: `#FF6600`（オレンジ）
   - **ラベル**: 「Direct Connect 経由（本番運用）」
   - **始点**: Transit Gateway アイコン下部
   - **終点**: Service Account (prod) の Transit Gateway Attachment 上部

---

### 5.2 Client VPN フロー（dev）

#### 拠点 → Client VPN → Transit Gateway → dev VPC

1. **拠点 → Client VPN Endpoint**
   - **種類**: 点線、太線（太さ4px）
   - **色**: `#0066FF`（青）
   - **ラベル**: 「VPN 接続」
   - **始点**: 拠点ボックス下部中央
   - **終点**: Client VPN Endpoint アイコン上部

2. **Client VPN Endpoint → Transit Gateway**
   - **種類**: 点線、太線（太さ3px）
   - **色**: `#0066FF`（青）
   - **ラベル**: 「Client VPN 経由（コスト削減）」
   - **始点**: Client VPN Endpoint アイコン下部
   - **終点**: Transit Gateway アイコン上部

3. **Transit Gateway → dev VPC（Transit Gateway Attachment）**
   - **種類**: 点線、太線（太さ4px）
   - **色**: `#0066FF`（青）
   - **ラベル**: 「Client VPN 経由」
   - **始点**: Transit Gateway アイコン下部
   - **終点**: Service Account (dev) の Transit Gateway Attachment 上部

---

### 5.3 インターネットフロー（すべての環境）

#### 事業者 → ALB（事業者アプリ）

1. **事業者 → dev ALB（事業者アプリ）**
   - **種類**: 実線、太線（太さ2px）
   - **色**: `#4CAF50`（緑）
   - **ラベル**: 「HTTPS」
   - **始点**: インターネット（事業者）ボックス
   - **終点**: Service Account (dev) の ALB（事業者アプリ）

2. **事業者 → stg ALB（事業者アプリ）**
   - **種類**: 実線、太線（太さ2px）
   - **色**: `#4CAF50`（緑）
   - **ラベル**: 「HTTPS」
   - **始点**: インターネット（事業者）ボックス
   - **終点**: Service Account (stg) の ALB（事業者アプリ）

3. **事業者 → prod ALB（事業者アプリ）**
   - **種類**: 実線、太線（太さ2px）
   - **色**: `#4CAF50`（緑）
   - **ラベル**: 「HTTPS」
   - **始点**: インターネット（事業者）ボックス
   - **終点**: Service Account (prod) の ALB（事業者アプリ）

---

### 5.4 監査フロー（すべての環境）

#### Shared Account → Service Account (dev/stg/prod)

1. **Organizations → Service Account (dev)**
   - **種類**: 点線（太さ1px）
   - **色**: `#9C27B0`（紫）
   - **ラベル**: 「管理」
   - **始点**: Organizations アイコン
   - **終点**: Service Account (dev) 外枠

2. **Organizations → Service Account (stg)**
   - **種類**: 点線（太さ1px）
   - **色**: `#9C27B0`（紫）
   - **ラベル**: 「管理」
   - **始点**: Organizations アイコン
   - **終点**: Service Account (stg) 外枠

3. **Organizations → Service Account (prod)**
   - **種類**: 点線（太さ1px）
   - **色**: `#9C27B0`（紫）
   - **ラベル**: 「管理」
   - **始点**: Organizations アイコン
   - **終点**: Service Account (prod) 外枠

4. **CloudTrail → Service Account (dev/stg/prod)**
   - **種類**: 点線（太さ1px）
   - **色**: `#9C27B0`（紫）
   - **ラベル**: 「監査ログ収集」
   - **始点**: CloudTrail アイコン
   - **終点**: Service Account (dev/stg/prod) 外枠

5. **Config → Service Account (dev/stg/prod)**
   - **種類**: 点線（太さ1px）
   - **色**: `#9C27B0`（紫）
   - **ラベル**: 「設定変更記録」
   - **始点**: Config アイコン
   - **終点**: Service Account (dev/stg/prod) 外枠

6. **GuardDuty → Service Account (dev/stg/prod)**
   - **種類**: 点線（太さ1px）
   - **色**: `#9C27B0`（紫）
   - **ラベル**: 「脅威検知」
   - **始点**: GuardDuty アイコン
   - **終点**: Service Account (dev/stg/prod) 外枠

7. **Security Hub → Service Account (dev/stg/prod)**
   - **種類**: 点線（太さ1px）
   - **色**: `#9C27B0`（紫）
   - **ラベル**: 「セキュリティ統合」
   - **始点**: Security Hub アイコン
   - **終点**: Service Account (dev/stg/prod) 外枠

---

## 6. 凡例

### 位置
- **位置**: キャンバス右下（X: 1100px, Y: 1850px）
- **サイズ**: 幅250px × 高さ120px

### 内容

```
【接続方式】
━━━━ Direct Connect（prod/stg）
- - - - Client VPN（dev）
━━━  インターネット
- - -  監査フロー

【アカウント】
■ Shared Account（共有基盤）
■ Service Account (dev)（開発環境）
■ Service Account (stg)（ステージング環境）
■ Service Account (prod)（本番環境）
```

---

## 7. 注釈

### 重要な注釈を追加

1. **Direct Connect セクションの注釈**
   - **テキスト**: 「本番運用（prod/stg 共有）」
   - **位置**: Direct Connect セクション下部
   - **フォント**: Arial、12pt、Italic
   - **色**: `#FF6600`（オレンジ）

2. **Client VPN セクションの注釈**
   - **テキスト**: 「開発環境のみ（コスト削減）」
   - **位置**: Client VPN セクション下部
   - **フォント**: Arial、12pt、Italic
   - **色**: `#0066FF`（青）

3. **Transit Gateway セクションの注釈**
   - **テキスト**: 「すべての環境（dev/stg/prod）のハブ」
   - **位置**: Transit Gateway セクション下部
   - **フォント**: Arial、12pt、Italic
   - **色**: `#FFC107`（黄色）

---

## 8. チェックリスト

作成完了前に以下を確認してください：

### アカウント構成
- [ ] Shared Account（共有基盤）が明確に表現されている
- [ ] Service Account (dev)（開発環境専用アカウント）が独立した枠で表現されている
- [ ] Service Account (stg)（ステージング環境専用アカウント）が独立した枠で表現されている
- [ ] Service Account (prod)（本番環境専用アカウント）が独立した枠で表現されている
- [ ] 各アカウントの VPC CIDR が正しい（dev: 10.0.0.0/16、stg: 10.1.0.0/16、prod: 10.2.0.0/16）

### 接続方式
- [ ] Direct Connect フローが**実線・太線・オレンジ色**で表現されている
- [ ] Client VPN フローが**点線・太線・青色**で表現されている
- [ ] Direct Connect が prod/stg で共有されることが明記されている
- [ ] Client VPN が dev 専用であることが明記されている

### コンポーネント
- [ ] すべての AWS サービスアイコンが正確に配置されている
- [ ] Transit Gateway が Shared Account に配置されている
- [ ] Direct Connect Gateway が Shared Account に配置されている
- [ ] Client VPN Endpoint が Shared Account に配置されている
- [ ] 監査サービス（CloudTrail、Config、GuardDuty、Security Hub）が Shared Account に配置されている

### データフロー
- [ ] 拠点 → Direct Connect → Transit Gateway → stg/prod VPC のフローが明確
- [ ] 拠点 → Client VPN → Transit Gateway → dev VPC のフローが明確
- [ ] 監査フロー（CloudTrail、Config、GuardDuty、Security Hub → dev/stg/prod）が明確

### 視覚的品質
- [ ] 色分けが適切（Shared: 青、dev: 緑、stg: オレンジ、prod: 赤）
- [ ] 枠線の太さが適切（アカウント: 3px、サブネット: 1-2px）
- [ ] テキストが読みやすい（フォントサイズ適切）
- [ ] 凡例が追加されている

### 注釈
- [ ] Direct Connect の注釈（prod/stg 共有）が追加されている
- [ ] Client VPN の注釈（dev 専用、コスト削減）が追加されている
- [ ] Transit Gateway の注釈（すべての環境のハブ）が追加されている

---

## 9. 出力形式

### エクスポート設定
- **形式**: PNG、SVG
- **解像度**: 300dpi（PNG の場合）
- **背景**: 白色
- **余白**: 上下左右各20px

### ファイル名
- `マルチアカウント全体構成図_v1.2.png`
- `マルチアカウント全体構成図_v1.2.svg`

---

**作成者**: architect サブエージェント
**最終更新**: 2025-10-29
