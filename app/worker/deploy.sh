#!/usr/bin/env bash
# 用 Cloudflare API 直接上传 module worker（不需要 wrangler 登录）。
# 需要：环境里能访问 api.cloudflare.com 且已带认证（沙箱自动注入；别处运行请自行加 -H "Authorization: Bearer $CF_API_TOKEN"）。
# 密钥 INCEPTION_API_KEY 不在这里设置；keep_bindings 保证重新部署不会删掉控制台里设好的 secret。
set -euo pipefail
cd "$(dirname "$0")"
ACCOUNT=${CF_ACCOUNT_ID:-aa87b2e3fc8e53a23f8f48c740912ba6}
NAME=${WORKER_NAME:-aig-planner}
KV_ID=${KV_ID:-0d17ad7f24d242cc897c0310f03e3daf}   # KV namespace「aig-planner-limits」
node scripts/build-catalog.mjs
cat > /tmp/aig-meta.json <<JSON
{
  "main_module": "index.js",
  "compatibility_date": "2025-09-01",
  "keep_bindings": ["secret_text", "secret_key"],
  "bindings": [
    { "type": "kv_namespace", "name": "LIMITS", "namespace_id": "$KV_ID" },
    { "type": "plain_text", "name": "IP_DAILY", "text": "10" },
    { "type": "plain_text", "name": "GLOBAL_DAILY", "text": "300" },
    { "type": "plain_text", "name": "REASONING_EFFORT", "text": "low" }
  ],
  "observability": { "enabled": true }
}
JSON
API=https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/workers/scripts/$NAME
curl -sS -X PUT "$API" \
  -F "metadata=@/tmp/aig-meta.json;type=application/json" \
  -F "index.js=@index.js;type=application/javascript+module" \
  -F "planner-core.js=@planner-core.js;type=application/javascript+module" \
  -F "catalog.js=@catalog.js;type=application/javascript+module" \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print('upload', d['success'], d.get('errors'))"
curl -sS -X POST "$API/subdomain" -H 'content-type: application/json' -d '{"enabled":true,"previews_enabled":false}' \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print('workers.dev', d['success'], d.get('errors'))"
echo "https://$NAME.q1f0730.workers.dev"
