#!/bin/bash

echo "🍎 SWIFT FRONTEND INTEGRATION TEST"
echo "=================================="
echo ""

declare -a MATRIX
add_result() {
    MATRIX+=("$1|$2|$3|$4")
}

CANDIDATE_PORTS=(8014 8013 8080 8888)
OPTIONAL_SERVICES=("supabase")
BACKEND_URL=""
CHAT_TMP=""

echo "Checking unified backend connectivity..."
for port in "${CANDIDATE_PORTS[@]}"; do
    url="http://localhost:${port}"
    health_tmp=$(mktemp)
    health_code=$(curl -s -m 5 -w "%{http_code}" -o "$health_tmp" "$url/health" 2>/dev/null || echo "000")
    rm -f "$health_tmp"
    health_code=$(echo "$health_code" | tr -d '\n\r')
    if [[ "$health_code" != "200" ]]; then
        continue
    fi
    tmp=$(mktemp)
    chat_code=$(curl -s -m 20 -w "%{http_code}" -o "$tmp" \
        -H "Content-Type: application/json" \
        -d '{"message":"Frontend integration test"}' \
        "$url/api/chat" 2>/dev/null || echo "000")
    chat_code=$(echo "$chat_code" | tr -d '\n\r')
    if [[ "$chat_code" == "200" ]]; then
        BACKEND_URL="$url"
        CHAT_TMP="$tmp"
        break
    fi
    rm -f "$tmp"
done

if [[ -z "$BACKEND_URL" ]]; then
    echo "  ❌ Unified backend API not reachable on ports: ${CANDIDATE_PORTS[*]}"
    add_result "Chat API" "--" "FAIL" "No /api/chat responder"
else
    echo "  ✅ Unified backend online at ${BACKEND_URL}"
    chat_analysis=$(python3 - "$CHAT_TMP" <<'PY'
import json, sys
path = sys.argv[1]
try:
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    response = data.get("response", "")
    model = data.get("model_used", "unknown")
    status = "PASS" if data.get("status") == "success" and response else "WARN"
    note = f"{len(response)} chars via {model}"
except Exception as exc:
    status = "WARN"
    note = f"Invalid chat JSON ({exc})"
print(f"{status}|{note}")
PY
)
    rm -f "$CHAT_TMP"
    chat_status=${chat_analysis%%|*}
    chat_note=${chat_analysis#*|}
    if [[ "$chat_status" == "PASS" ]]; then
        echo "    ✅ Chat endpoint responded (${chat_note})"
    else
        echo "    ⚠️  Chat endpoint response issue (${chat_note})"
    fi
    add_result "Chat API" "${BACKEND_URL##*:}" "$chat_status" "$chat_note"
fi

echo ""
echo "Checking TTS service (port 8888)..."
tts_tmp=$(mktemp)
tts_code=$(curl -s -m 20 -w "%{http_code}" -o "$tts_tmp" \
    -H "Content-Type: application/json" \
    -d '{"text":"Frontend integration test"}' \
    "http://localhost:8888/api/tts/speak" 2>/dev/null || echo "000")
tts_code=$(echo "$tts_code" | tr -d '\n\r')
if [[ "$tts_code" == "200" ]]; then
    tts_analysis=$(python3 - "$tts_tmp" <<'PY'
import base64, json, sys
path = sys.argv[1]
try:
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    if data.get("success") and data.get("audio_base64"):
        try:
            decoded = base64.b64decode(data["audio_base64"])
            status = "PASS"
            note = f"{len(decoded)} bytes audio payload"
        except Exception as exc:
            status = "WARN"
            note = f"Audio decode failed ({exc})"
    else:
        status = "WARN"
        note = "No audio payload"
except Exception as exc:
    status = "FAIL"
    note = f"TTS JSON error ({exc})"
print(f"{status}|{note}")
PY
)
else
    tts_analysis="FAIL|HTTP ${tts_code}"
fi
rm -f "$tts_tmp"
tts_status=${tts_analysis%%|*}
tts_note=${tts_analysis#*|}
if [[ "$tts_status" == "PASS" ]]; then
    echo "  ✅ TTS service produced audio (${tts_note})"
else
    echo "  ❌ TTS service issue (${tts_note})"
fi
add_result "TTS Service" "8888" "$tts_status" "$tts_note"

echo ""
echo "Checking knowledge services..."
for svc in \
    "Knowledge Gateway|8088|http://localhost:8088/health" \
    "Knowledge Sync|8089|http://localhost:8089/health" \
    "Knowledge Context|8091|http://localhost:8091/health"
do
    IFS='|' read -r name port url <<< "$svc"
    resp=$(curl -s -m 8 "$url" 2>/dev/null)
    if [[ -z "$resp" ]]; then
        echo "  ❌ ${name} (${port}) unreachable"
        add_result "$name" "$port" "FAIL" "No response"
        continue
    fi
    analysis=$(python3 - "$resp" "${OPTIONAL_SERVICES[@]}" <<'PY'
import json, sys
raw = sys.argv[1]
optional = set(sys.argv[2:])
if not raw:
    print("FAIL|Empty response")
    raise SystemExit(0)
try:
    data = json.loads(raw)
    services = data.get("services", {})
    status = "PASS"
    if data.get("status") != "healthy":
        status = "WARN"
    elif services and any((not v) and (k not in optional) for k, v in services.items()):
        status = "WARN"
    if services:
        pairs = []
        for key, value in services.items():
            if value:
                label = "ok"
            else:
                label = "unused" if key in optional else "down"
            pairs.append(f"{key}:{label}")
        note = ", ".join(pairs)
    else:
        note = "No downstream details"
except Exception as exc:
    status = "FAIL"
    note = f"Parse error ({exc})"
print(f"{status}|{note}")
PY
)
    svc_status=${analysis%%|*}
    svc_note=${analysis#*|}
    if [[ "$svc_status" == "PASS" ]]; then
        echo "  ✅ ${name} healthy (${svc_note})"
    elif [[ "$svc_status" == "WARN" ]]; then
        echo "  ⚠️  ${name} partial (${svc_note})"
    else
        echo "  ❌ ${name} issue (${svc_note})"
    fi
    add_result "$name" "$port" "$svc_status" "$svc_note"
done

echo ""
echo "Checking vector store (Weaviate, port 8090)..."
weaviate_code=$(curl -s -m 5 -w "%{http_code}" -o /dev/null "http://localhost:8090/v1/.well-known/ready" 2>/dev/null || echo "000")
weaviate_code=$(echo "$weaviate_code" | tr -d '\n\r')
if [[ "$weaviate_code" == "200" ]]; then
    echo "  ✅ Weaviate ready endpoint responded"
    add_result "Weaviate" "8090" "PASS" "ready=200"
else
    echo "  ❌ Weaviate not ready (HTTP ${weaviate_code})"
    add_result "Weaviate" "8090" "FAIL" "ready=${weaviate_code}"
fi

echo ""
echo "🎉 FRONTEND INTEGRATION TEST COMPLETE"
echo "====================================="
echo ""
echo "Service status matrix:"
printf "  | %-20s | %-5s | %-4s | %s |\n" "Service" "Port" "Res" "Notes"
printf "  | %-20s | %-5s | %-4s | %s |\n" "--------------------" "-----" "----" "--------------------------------"
for row in "${MATRIX[@]}"; do
    IFS='|' read -r svc port res note <<< "$row"
    printf "  | %-20s | %-5s | %-4s | %s |\n" "$svc" "$port" "$res" "$note"
done
