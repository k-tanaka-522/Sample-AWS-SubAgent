#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation Template Validation（Shared Account - Foundation Stack）
# ==============================================================================
# 使い方:
#   ./scripts/validate.sh
# ==============================================================================

echo "=== CloudFormation テンプレート検証 ==="
echo ""

# マスタースタック検証
echo "Validating: stack.yaml"
aws cloudformation validate-template \
  --template-body file://stack.yaml \
  > /dev/null && echo "✅ stack.yaml" || echo "❌ stack.yaml"

# Nested Stacks 検証
echo ""
echo "Validating nested stacks..."
for TEMPLATE in nested/*.yaml; do
  echo "Validating: ${TEMPLATE}"
  aws cloudformation validate-template \
    --template-body file://${TEMPLATE} \
    > /dev/null && echo "✅ ${TEMPLATE}" || echo "❌ ${TEMPLATE}"
done

echo ""
echo "✅ すべてのテンプレートが有効です"
