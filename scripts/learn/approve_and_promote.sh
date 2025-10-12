#!/usr/bin/env bash
# Auto-approval with safety gates
# Still requires human trigger, but gates bad promotions automatically

set -euo pipefail

CAND="${1:-$(ls -dt artifacts/trm/* 2>/dev/null | head -1)}"

if [ -z "$CAND" ] || [ ! -d "$CAND" ]; then
    echo "❌ No candidate found. Provide path or run evaluation first."
    exit 1
fi

echo "🔍 Evaluating candidate: $CAND"

# Safety gates from metrics.json
if [ ! -f "$CAND/metrics.json" ]; then
    echo "❌ No metrics.json found in candidate directory"
    exit 1
fi

# Check safety regressions
SAFETY_REGRESSIONS=$(jq -r '.safety_regressions // 1' "$CAND/metrics.json")
if [ "$SAFETY_REGRESSIONS" != "0" ]; then
    echo "❌ Safety regressions detected: $SAFETY_REGRESSIONS"
    echo "   Manual review required before promotion"
    exit 2
fi

# Check accuracy improvement
BASELINE_ACC=$(jq -r '.baseline_route_accuracy // 0' "$CAND/metrics.json")
CAND_ACC=$(jq -r '.route_accuracy // 0' "$CAND/metrics.json")

if (( $(echo "$CAND_ACC <= $BASELINE_ACC" | bc -l) )); then
    echo "❌ No accuracy improvement"
    echo "   Baseline: $BASELINE_ACC, Candidate: $CAND_ACC"
    exit 2
fi

# Check for suspiciously high delta (possible eval error)
DELTA=$(echo "$CAND_ACC - $BASELINE_ACC" | bc -l)
MAX_DELTA="${TRM_MAX_DELTA:-0.15}"

if (( $(echo "$DELTA > $MAX_DELTA" | bc -l) )); then
    echo "❌ Accuracy delta too large: $DELTA (max: $MAX_DELTA)"
    echo "   Suspiciously high improvement - manual review required"
    exit 2
fi

# All gates passed
echo "✅ Safety gates passed:"
echo "   - No safety regressions"
echo "   - Accuracy improved: $BASELINE_ACC → $CAND_ACC (+$DELTA)"
echo "   - Delta within bounds (<$MAX_DELTA)"
echo ""

# Promote
if [ -f "scripts/learn/promote.py" ]; then
    echo "🚀 Promoting candidate..."
    python3 scripts/learn/promote.py --candidate "$CAND"
    echo "✅ Promoted $CAND"
else
    echo "⚠️  promote.py not found, manual promotion needed"
    echo "   Candidate ready at: $CAND"
fi

