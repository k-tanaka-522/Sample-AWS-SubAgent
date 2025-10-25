#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation Template Validation
# ==============================================================================

echo "===================================="
echo "CloudFormation テンプレート検証"
echo "===================================="
echo ""

# 親スタックの検証
echo "[1] Validating: stack.yaml (Master Stack)"
if aws cloudformation validate-template \
  --template-body "file://stack.yaml" \
  > /dev/null 2>&1; then
  echo "    ✅ Valid"
  TOTAL=1
  SUCCESS=1
  FAILED=0
else
  echo "    ❌ Invalid"
  TOTAL=1
  SUCCESS=0
  FAILED=1
fi

echo ""

# ネステッドスタックの検証
TEMPLATES=$(find nested -name "*.yaml" -type f | sort)

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
