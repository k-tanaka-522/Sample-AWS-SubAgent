#!/bin/bash

###############################################################################
# CloudFormation テンプレートのセキュリティ静的解析
#
# ツール: cfn_nag
# 対象: infra/cloudformation/ 配下のすべてのYAMLテンプレート
# 目的: セキュリティベストプラクティスへの準拠チェック
###############################################################################

set -euo pipefail

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "CloudFormation セキュリティチェック開始"
echo "========================================="

# cfn_nag のインストール確認
if ! command -v cfn_nag &> /dev/null; then
    echo -e "${YELLOW}cfn_nag がインストールされていません。インストールします...${NC}"
    gem install cfn-nag
fi

# CFnテンプレートディレクトリ
CFN_DIR="../infra/cloudformation"

if [ ! -d "$CFN_DIR" ]; then
    echo -e "${RED}エラー: CloudFormationディレクトリが見つかりません: $CFN_DIR${NC}"
    exit 1
fi

# 結果ファイル
REPORT_FILE="cfn-nag-report.txt"
echo "レポート出力先: $REPORT_FILE"
echo "" > "$REPORT_FILE"

# 失敗カウンター
FAILURE_COUNT=0
WARNING_COUNT=0

# すべてのYAMLファイルをチェック
echo ""
echo "テンプレート検査中..."
echo ""

for template in "$CFN_DIR"/**/*.{yml,yaml}; do
    if [ -f "$template" ]; then
        echo "----------------------------------------" | tee -a "$REPORT_FILE"
        echo "チェック対象: $template" | tee -a "$REPORT_FILE"
        echo "----------------------------------------" | tee -a "$REPORT_FILE"

        # cfn_nag 実行
        if cfn_nag_scan --input-path "$template" >> "$REPORT_FILE" 2>&1; then
            echo -e "${GREEN}✓ Pass: $(basename $template)${NC}"
        else
            echo -e "${RED}✗ Fail: $(basename $template)${NC}"
            FAILURE_COUNT=$((FAILURE_COUNT + 1))
        fi

        echo "" | tee -a "$REPORT_FILE"
    fi
done

# サマリー表示
echo ""
echo "========================================="
echo "チェック完了"
echo "========================================="
echo ""

# レポートからWarning/Failureをカウント
WARNING_COUNT=$(grep -c "^WARN" "$REPORT_FILE" || true)
FAILURE_COUNT=$(grep -c "^FAIL" "$REPORT_FILE" || true)

echo "結果サマリー:"
echo "  - Warnings: $WARNING_COUNT"
echo "  - Failures: $FAILURE_COUNT"
echo ""

if [ "$FAILURE_COUNT" -gt 0 ]; then
    echo -e "${RED}❌ セキュリティチェックに失敗しました${NC}"
    echo ""
    echo "詳細は $REPORT_FILE を確認してください"
    echo ""
    echo "主な修正項目:"
    echo "  - S3バケットの暗号化設定"
    echo "  - Security Groupの0.0.0.0/0禁止"
    echo "  - IAMロールの最小権限"
    echo "  - RDS暗号化有効化"
    echo "  - CloudTrail有効化"
    exit 1
elif [ "$WARNING_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  警告があります（修正推奨）${NC}"
    echo ""
    echo "詳細は $REPORT_FILE を確認してください"
    exit 0
else
    echo -e "${GREEN}✅ すべてのチェックに合格しました${NC}"
    exit 0
fi
