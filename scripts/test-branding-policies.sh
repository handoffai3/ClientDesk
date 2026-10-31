#!/usr/bin/env bash
set -euo pipefail
#
# Test branding bucket storage policies with real user sessions.
#
# Usage:
#   AGENCY_PASSWORD='...' CLIENT_PASSWORD='...' bash scripts/test-branding-policies.sh
#
# Reads PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY from .env
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"

# Source .env
if [[ -f "$ENV_FILE" ]]; then
  export $(grep -E '^(PUBLIC_SUPABASE_URL|PUBLIC_SUPABASE_ANON_KEY)=' "$ENV_FILE" | tr -d '"' | xargs)
fi

SUPABASE_URL="${PUBLIC_SUPABASE_URL:?Set PUBLIC_SUPABASE_URL}"
ANON_KEY="${PUBLIC_SUPABASE_ANON_KEY:?Set PUBLIC_SUPABASE_ANON_KEY}"
AGENCY_PASSWORD="${AGENCY_PASSWORD:?Set AGENCY_PASSWORD}"
CLIENT_PASSWORD="${CLIENT_PASSWORD:?Set CLIENT_PASSWORD}"

AGENCY_ID="3060b4b4-f0d2-4a5e-ad2a-a7f08231f2b6"
FAKE_AGENCY_ID="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

# Create a tiny valid PNG
TMP_PNG=$(mktemp /tmp/test-branding-XXXX.png)
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82' > "$TMP_PNG"

sign_in() {
  local email=$1 password=$2
  curl -sf -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
    -H "Content-Type: application/json" \
    -H "apikey: ${ANON_KEY}" \
    -d "{\"email\":\"${email}\",\"password\":\"${password}\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])"
}

echo "--- Signing in ---"
AGENCY_TOKEN=$(sign_in "melekithm@gmail.com" "$AGENCY_PASSWORD")
echo "  Agency user signed in"
CLIENT_TOKEN=$(sign_in "handoffai3@gmail.com" "$CLIENT_PASSWORD")
echo "  Client user signed in"

echo ""
echo "=== TEST A: Agency uploads to OWN folder (expect 200) ==="
STATUS_A=$(curl -s -o /dev/null -w '%{http_code}' \
  -X POST "${SUPABASE_URL}/storage/v1/object/branding/${AGENCY_ID}/test-policy.png" \
  -H "Authorization: Bearer ${AGENCY_TOKEN}" \
  -H "Content-Type: image/png" \
  --data-binary "@${TMP_PNG}")
echo "  Status: ${STATUS_A}"

echo ""
echo "=== TEST B: Agency uploads to ANOTHER agency's folder (expect 403) ==="
STATUS_B=$(curl -s -o /dev/null -w '%{http_code}' \
  -X POST "${SUPABASE_URL}/storage/v1/object/branding/${FAKE_AGENCY_ID}/test-policy.png" \
  -H "Authorization: Bearer ${AGENCY_TOKEN}" \
  -H "Content-Type: image/png" \
  --data-binary "@${TMP_PNG}")
echo "  Status: ${STATUS_B}"

echo ""
echo "=== TEST C: Client uploads to branding bucket (expect 403) ==="
STATUS_C=$(curl -s -o /dev/null -w '%{http_code}' \
  -X POST "${SUPABASE_URL}/storage/v1/object/branding/${AGENCY_ID}/client-test.png" \
  -H "Authorization: Bearer ${CLIENT_TOKEN}" \
  -H "Content-Type: image/png" \
  --data-binary "@${TMP_PNG}")
echo "  Status: ${STATUS_C}"

echo ""
echo "=== TEST D: Anonymous reads public logo (expect 200) ==="
STATUS_D=$(curl -s -o /dev/null -w '%{http_code}' \
  "${SUPABASE_URL}/storage/v1/object/public/branding/${AGENCY_ID}/test-policy.png")
echo "  Status: ${STATUS_D}"

echo ""
echo "=== CLEANUP: Agency deletes own test file ==="
STATUS_DEL=$(curl -s -o /dev/null -w '%{http_code}' \
  -X DELETE "${SUPABASE_URL}/storage/v1/object/branding/${AGENCY_ID}/test-policy.png" \
  -H "Authorization: Bearer ${AGENCY_TOKEN}")
echo "  Delete status: ${STATUS_DEL}"

rm -f "$TMP_PNG"

echo ""
PASS=true
[[ "$STATUS_A" == "200" ]] && echo "✅ A: Agency own-folder upload: ${STATUS_A}" || { echo "❌ A: Agency own-folder upload: ${STATUS_A} (expected 200)"; PASS=false; }
[[ "$STATUS_B" == "403" ]] && echo "✅ B: Agency cross-folder upload: ${STATUS_B}" || { echo "❌ B: Agency cross-folder upload: ${STATUS_B} (expected 403)"; PASS=false; }
[[ "$STATUS_C" == "403" ]] && echo "✅ C: Client upload: ${STATUS_C}" || { echo "❌ C: Client upload: ${STATUS_C} (expected 403)"; PASS=false; }
[[ "$STATUS_D" == "200" ]] && echo "✅ D: Anonymous read: ${STATUS_D}" || { echo "❌ D: Anonymous read: ${STATUS_D} (expected 200)"; PASS=false; }

echo ""
$PASS && echo "✅ ALL BRANDING POLICY TESTS PASSED" || echo "❌ SOME TESTS FAILED"
