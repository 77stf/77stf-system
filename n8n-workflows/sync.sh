#!/bin/bash
# ─── 77STF n8n Workflow Sync ──────────────────────────────────────────────────
# Upserts all workflow JSON files to n8n via REST API
# Usage: bash n8n-workflows/sync.sh

N8N_URL="https://n8n.socmid.cloud"
N8N_API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiMzMxMGI3ZC0xNzZiLTQ4NjMtYWY0Ny1lYzY5NDAzMWM1MjUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc1NjQ1OTU2LCJleHAiOjE3NzgxOTEyMDB9.4f302HwkIiOQU-gnauxHveWgWQW8Joz9aRRrCD6fuL4"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🔄 Syncing n8n workflows to $N8N_URL"

# Fetch existing workflows
EXISTING=$(curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_URL/api/v1/workflows")

for FILE in "$SCRIPT_DIR"/*.json; do
  WORKFLOW_NAME=$(python3 -c "import json,sys; print(json.load(open('$FILE'))['name'])" 2>/dev/null || node -e "console.log(require('$FILE').name)")
  echo ""
  echo "📋 Processing: $WORKFLOW_NAME ($FILE)"

  # Check if workflow with this name already exists
  EXISTING_ID=$(echo "$EXISTING" | python3 -c "
import json,sys
data = json.load(sys.stdin)
items = data.get('data', [])
match = next((w for w in items if w['name'] == '$WORKFLOW_NAME'), None)
print(match['id'] if match else '')
" 2>/dev/null || echo "$EXISTING" | node -e "
const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const m=(d.data||[]).find(w=>w.name==='$WORKFLOW_NAME');
console.log(m?m.id:'');
")

  if [ -n "$EXISTING_ID" ]; then
    echo "   ↻ Updating existing workflow (id: $EXISTING_ID)"
    RESPONSE=$(curl -s -X PUT \
      -H "X-N8N-API-KEY: $N8N_API_KEY" \
      -H "Content-Type: application/json" \
      -d @"$FILE" \
      "$N8N_URL/api/v1/workflows/$EXISTING_ID")
  else
    echo "   ✚ Creating new workflow"
    RESPONSE=$(curl -s -X POST \
      -H "X-N8N-API-KEY: $N8N_API_KEY" \
      -H "Content-Type: application/json" \
      -d @"$FILE" \
      "$N8N_URL/api/v1/workflows")
  fi

  # Extract ID from response and activate
  NEW_ID=$(echo "$RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "$RESPONSE" | node -e "try{const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));console.log(d.id||'')}catch(e){console.log('')}")

  if [ -n "$NEW_ID" ]; then
    # Activate the workflow
    curl -s -X PATCH \
      -H "X-N8N-API-KEY: $N8N_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{"active": true}' \
      "$N8N_URL/api/v1/workflows/$NEW_ID" > /dev/null
    echo "   ✅ Done (id: $NEW_ID) — activated"
  else
    echo "   ❌ Error: $RESPONSE"
  fi
done

echo ""
echo "✅ Sync complete."
