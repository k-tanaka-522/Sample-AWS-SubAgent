#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation Template Validation
# ==============================================================================

echo "===================================="
echo "CloudFormation テンプレート検証"
echo "===================================="
echo ""

TEMPLATES=$(find nested -name "*.yaml" -type f)
TOTAL=0
SUCCESS=0
FAILED=0

for TEMPLATE in $TEMPLATES; do
  TOTAL=$((TOTAL + 1))
  echo "[$TOTAL] Validating: $TEMPLATE"

  if aws cloudformation validate-template \
    --template-body "file://${TEMPLATE}" \
    > /dev/null 2>&1; then
    echo "    ✅ Valid"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "    ❌ Invalid"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "===================================="
echo "検証結果"
echo "===================================="
echo "Total:    ${TOTAL}"
echo "Success:  ${SUCCESS}"
echo "Failed:   ${FAILED}"
echo "===================================="

if [ "${FAILED}" -gt 0 ]; then
  echo "❌ 一部のテンプレートに問題があります"
  exit 1
else
  echo "✅ すべてのテンプレートが正常です"
  exit 0
fi
