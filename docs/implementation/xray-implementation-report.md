# AWS X-Ray 実装完了レポート

**作成日**: 2025-10-28
**作成者**: SRE
**ステータス**: 実装完了、デプロイ待ち

---

## 1. 実装概要

architectサブエージェントが設計したAWS X-Rayの分散トレーシング機能を、CloudFormationテンプレートに実装しました。

### 実装対象

- ECS Fargate Task Definitions（3つのタスクすべて）
  - staff-api
  - vendor-api
  - batch
- IAM Role（X-Ray権限追加）
- CloudWatch Log Group（X-Rayデーモン用）
- CloudWatch Alarms（X-Ray監視アラーム）

---

## 2. 更新したファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `infra/cloudformation/service/templates/compute/ecs-task-definitions.yaml` | X-Rayサイドカーコンテナ追加、IAM権限追加、環境変数追加、Log Group追加 |
| `infra/cloudformation/service/templates/monitoring/cloudwatch-alarms.yaml` | X-Rayエラー率・レスポンスタイムアラーム追加 |

---

## 3. 追加したリソースのサマリー

### 3.1 X-Ray サイドカーコンテナ（3タスクすべてに追加）

各ECS Task Definition（staff-api, vendor-api, batch）に以下のサイドカーコンテナを追加：

```yaml
- Name: xray-daemon
  Image: public.ecr.aws/xray/aws-xray-daemon:latest
  Cpu: 32
  Memory: 256
  PortMappings:
    - ContainerPort: 2000
      Protocol: udp
  Environment:
    - Name: AWS_REGION
      Value: !Ref AWS::Region
  LogConfiguration:
    LogDriver: awslogs
    Options:
      awslogs-group: !Ref XRayLogGroup
      awslogs-region: !Ref AWS::Region
      awslogs-stream-prefix: {task-name}-xray
```

**リソース**:
- CPU: 32（0.03125 vCPU）
- メモリ: 256MB
- コスト影響: 最小限（月額約3,420円増加見込み）

### 3.2 アプリケーションコンテナの環境変数（3タスクすべて）

各アプリケーションコンテナに以下の環境変数を追加：

```yaml
Environment:
  - Name: AWS_XRAY_DAEMON_ADDRESS
    Value: xray-daemon:2000
  - Name: AWS_XRAY_CONTEXT_MISSING
    Value: LOG_ERROR
  - Name: AWS_XRAY_TRACING_NAME
    Value: !Sub ${ProjectName}-{task-name}
```

**説明**:
- `AWS_XRAY_DAEMON_ADDRESS`: サイドカーコンテナへの接続先
- `AWS_XRAY_CONTEXT_MISSING`: トレースコンテキストがない場合の挙動（ログ出力）
- `AWS_XRAY_TRACING_NAME`: X-Ray Service Mapで表示されるサービス名

### 3.3 IAM Role（X-Ray権限追加）

Task Execution Roleに以下の権限を追加：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "xray:PutTraceSegments",
        "xray:PutTelemetryRecords"
      ],
      "Resource": "*"
    }
  ]
}
```

**対象Role**: `${ProjectName}-${Environment}-ecs-task-execution-role`

### 3.4 CloudWatch Log Group（X-Rayデーモン用）

X-Rayデーモンのログを記録するLog Groupを追加：

```yaml
XRayLogGroup:
  Type: AWS::Logs::LogGroup
  Properties:
    LogGroupName: !Sub /ecs/${ProjectName}-${Environment}-xray
    RetentionInDays: 30
```

**保持期間**: 30日（設計書に準拠）

### 3.5 CloudWatch Alarms（X-Ray監視）

2つのアラームを追加：

#### (1) X-Ray エラー率アラーム

```yaml
XRayErrorRateHighAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: !Sub ${ProjectName}-${Environment}-xray-error-rate-high
    AlarmDescription: X-Ray エラー率が5%を超えました
    MetricName: ErrorRate
    Namespace: AWS/XRay
    Statistic: Average
    Period: 120
    EvaluationPeriods: 2
    Threshold: 5.0
    ComparisonOperator: GreaterThanThreshold
    Dimensions:
      - Name: ServiceName
        Value: !Sub ${ProjectName}-staff-api
    AlarmActions:
      - !Ref SNSTopicArn
    TreatMissingData: notBreaching
```

**閾値**: エラー率 5%以上、2分間連続で検知

#### (2) X-Ray レスポンスタイムアラーム（95%ile）

```yaml
XRayLatencyHighAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: !Sub ${ProjectName}-${Environment}-xray-latency-p95-high
    AlarmDescription: X-Ray レスポンスタイム（95%ile）が500msを超えました
    MetricName: ApproximateLatency
    Namespace: AWS/XRay
    ExtendedStatistic: p95
    Period: 120
    EvaluationPeriods: 2
    Threshold: 500.0
    ComparisonOperator: GreaterThanThreshold
    Dimensions:
      - Name: ServiceName
        Value: !Sub ${ProjectName}-staff-api
    AlarmActions:
      - !Ref SNSTopicArn
    TreatMissingData: notBreaching
```

**閾値**: レスポンスタイム（95%ile）500ms超過、2分間連続で検知

---

## 4. 動作確認方法（デプロイ後）

### 4.1 X-Ray コンソールでの確認

1. **AWS X-Ray コンソールにアクセス**
   - AWSコンソール → X-Ray → Service Map

2. **Service Mapの確認**
   - 以下のサービスが表示されることを確認：
     - `facilities-staff-api`
     - `facilities-vendor-api`
     - `facilities-batch`
   - 依存関係が視覚化されていることを確認（ECS → RDS、ECS → S3 等）

3. **トレースの確認**
   - X-Ray → Traces
   - トレースIDでフィルタリング可能
   - エラーが発生したトレースを確認

### 4.2 CloudWatch Logs での確認

1. **X-Rayデーモンのログ確認**
   - CloudWatch Logs → Log Groups
   - `/ecs/${ProjectName}-${Environment}-xray` を確認
   - エラーがないことを確認

2. **アプリケーションログとの連携確認**
   - アプリケーションログにトレースIDが含まれていることを確認
   - トレースIDで検索すると、関連するすべてのログを取得可能

### 4.3 CloudWatch Alarms の確認

1. **アラームの状態確認**
   - CloudWatch → Alarms
   - `${ProjectName}-${Environment}-xray-error-rate-high` が作成されていることを確認
   - `${ProjectName}-${Environment}-xray-latency-p95-high` が作成されていることを確認

2. **SNS通知のテスト**
   - 故意にエラーを発生させ、SNS通知が届くことを確認

---

## 5. 注意事項

### 5.1 アプリケーションコードへの変更が必要

X-Rayのトレーシングを有効にするには、アプリケーションコードに**AWS X-Ray SDK**を組み込む必要があります。

#### Node.js（Express）の場合

**インストール**:
```bash
npm install aws-xray-sdk-core aws-xray-sdk-express
```

**実装例**:
```javascript
const AWSXRay = require('aws-xray-sdk-core');
const express = require('express');

// ExpressアプリにX-Rayミドルウェアを追加
const app = express();
app.use(AWSXRay.express.openSegment('facilities-staff-api'));

// RDS、S3等のAWS SDK呼び出しを自動トレース
const AWS = AWSXRay.captureAWS(require('aws-sdk'));

// ルート定義
app.get('/api/equipment', async (req, res) => {
  // アプリケーションロジック
});

app.use(AWSXRay.express.closeSegment());
```

**重要なポイント**:
- `AWSXRay.express.openSegment()` と `closeSegment()` でリクエストをラップ
- `AWSXRay.captureAWS(require('aws-sdk'))` で AWS SDK の呼び出しを自動トレース
- 環境変数 `AWS_XRAY_DAEMON_ADDRESS` が自動的に使用される

### 5.2 サンプリングルールのカスタマイズ（オプション）

デフォルトでは、X-Ray SDK はすべてのリクエストをトレースします（100%サンプリング）。

設計書では環境別にサンプリング率を設定することを推奨しています：
- dev: 100%
- stg: 10%
- prod: 5%

**サンプリングルールの設定方法**:

アプリケーションコードに `sampling-rules.json` を追加：

```json
{
  "version": 2,
  "rules": [
    {
      "description": "Error sampling",
      "host": "*",
      "http_method": "*",
      "url_path": "*",
      "fixed_target": 0,
      "rate": 1.0,
      "priority": 1,
      "attributes": {
        "http.status": "5*"
      }
    },
    {
      "description": "Default sampling for production",
      "host": "*",
      "http_method": "*",
      "url_path": "*",
      "fixed_target": 1,
      "rate": 0.05,
      "priority": 100
    }
  ],
  "default": {
    "fixed_target": 1,
    "rate": 0.05
  }
}
```

アプリケーションコードで読み込み：

```javascript
const AWSXRay = require('aws-xray-sdk-core');
const samplingRules = require('./sampling-rules.json');

AWSXRay.middleware.setSamplingRules(samplingRules);
```

### 5.3 コスト影響

X-Ray追加によるコスト増加見込み：
- dev: +約600円/月
- stg: +約1,000円/月
- prod: +約1,820円/月
- **合計: +約3,420円/月（全体の1.1%）**

**コスト削減のヒント**:
- サンプリング率を調整（prod: 5% → 2%）でコスト削減可能
- エラーのみトレースする設定も可能

### 5.4 トレーシング対象サービス

X-Ray は以下の AWS サービスを自動的にトレースします（AWS SDK 経由）：
- RDS（SQLクエリの実行時間）
- S3（ファイルアップロード・ダウンロード）
- Cognito（認証リクエスト）
- その他のAWSサービス

**追加設定不要**で、これらのサービス呼び出しがX-Ray Service Mapに表示されます。

---

## 6. デプロイ手順

### 6.1 CloudFormation Change Set の作成

```bash
cd infra/cloudformation/service

# dev環境
./scripts/deploy-changeset.sh dev

# stg環境
./scripts/deploy-changeset.sh stg

# prod環境
./scripts/deploy-changeset.sh prod
```

### 6.2 Change Set の確認

```bash
# Change Set の内容を確認
./scripts/describe-changeset.sh dev <changeset-name>
```

**確認項目**:
- X-Ray Log Group が追加される
- Task Definition が更新される（X-Rayサイドカーコンテナ追加）
- IAM Role が更新される（X-Ray権限追加）
- CloudWatch Alarms が追加される（2つ）

### 6.3 Change Set の実行

```bash
# Change Set を実行
./scripts/execute-changeset.sh dev <changeset-name>
```

### 6.4 デプロイ後の確認

1. ECS タスクが正常に起動しているか確認
2. X-Ray コンソールでトレースが記録されているか確認
3. CloudWatch Alarms が作成されているか確認

---

## 7. トラブルシューティング

### 問題1: X-Rayデーモンコンテナが起動しない

**原因**: ECRからイメージをPullできない

**対処**:
- Task Execution Role に ECR アクセス権限があることを確認
- VPC Endpoints（ECR用）が設定されていることを確認

### 問題2: トレースが記録されない

**原因1**: アプリケーションコードに X-Ray SDK が組み込まれていない

**対処**: アプリケーションコードに X-Ray SDK を追加（上記 5.1 参照）

**原因2**: 環境変数 `AWS_XRAY_DAEMON_ADDRESS` が正しくない

**対処**: Task Definition の環境変数を確認（`xray-daemon:2000` であることを確認）

### 問題3: CloudWatch Alarms が発火しない

**原因**: X-Ray メトリクスが CloudWatch に送信されていない

**対処**:
- X-Ray デーモンのログを確認（`/ecs/${ProjectName}-${Environment}-xray`）
- IAM Role に `xray:PutTraceSegments` 権限があることを確認

---

## 8. 技術標準への準拠

以下の技術標準に準拠して実装しました：

- ✅ `.claude/docs/40_standards/45_cloudformation.md` - CloudFormation規約
  - パラメータ化、命名規則、コメント
  - Change Sets 使用（直接デプロイ禁止）
  - エラーハンドリング

- ✅ `.claude/docs/40_standards/49_security.md` - セキュリティ基準
  - IAM 最小権限の原則（X-Ray権限のみ）
  - ログの暗号化（CloudWatch Logs デフォルト暗号化）

- ✅ 基本設計書の設計方針に準拠
  - サイドカーパターン
  - 軽量設計（CPU: 32、メモリ: 256MB）
  - 環境変数による設定

---

## 9. 次のステップ

1. ✅ CloudFormation実装完了
2. ⏳ アプリケーションコードへのX-Ray SDK組み込み（coder サブエージェント）
3. ⏳ デプロイ実施（dev → stg → prod）
4. ⏳ X-Ray Service Mapでの動作確認
5. ⏳ 性能テスト（QA サブエージェント）
6. ⏳ サンプリングルールの調整（必要に応じて）

---

**PM への報告**:

AWS X-RayのCloudFormation実装が完了しました。

**追加リソース**:
- X-Rayサイドカーコンテナ（3タスク）
- X-Ray用CloudWatch Log Group
- X-Ray用IAM権限
- X-Ray用CloudWatch Alarms（2つ）

**注意事項**:
- アプリケーションコードへのX-Ray SDK組み込みが必要です（coder サブエージェントに委譲推奨）
- デプロイ後、X-Rayコンソールでトレースが記録されることを確認してください

**コスト影響**:
- 月額約3,420円増加（全体の1.1%、許容範囲内）

デプロイ実施の承認をお願いします。

---

**作成者**: SRE
**最終更新**: 2025-10-28
