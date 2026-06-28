#!/usr/bin/env bash
# End-to-end Solux pipeline: discover → ingest → indexes → model → E2E queries.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ -f "${REPO_ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${REPO_ROOT}/.env"
  set +a
fi

export DATA_ROOT="${DATA_ROOT:-/data/solux}"
export DATASET_VERSION="${DATASET_VERSION:-v0.1}"
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-${DIGITALOCEAN_SPACES_KEY:-}}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-${DIGITALOCEAN_SPACES_SECRET:-}}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; RESET='\033[0m'
log() { echo -e "${BLUE}[pipeline]${RESET} $*"; }
warn() { echo -e "${YELLOW}[warn]${RESET} $*"; }
ok() { echo -e "${GREEN}[ok]${RESET} $*"; }

require_env() {
  local missing=()
  for v in DIGITALOCEAN_SPACES_ENDPOINT DIGITALOCEAN_SPACES_BUCKET MONGODB_URI; do
    [[ -n "${!v:-}" ]] || missing+=("$v")
  done
  if ((${#missing[@]})); then
    echo "Missing required env: ${missing[*]}" >&2
    exit 1
  fi
}

require_env
mkdir -p "${DATA_ROOT}/manifests"

cd "${REPO_ROOT}"

log "Step 1 — Discover Spaces paths"
bash ops/spaces/discover-solux-paths.sh || warn "Discovery reported missing objects"

log "Step 2 — MongoDB indexes"
pnpm db:indexes

log "Step 3 — Ingest catalog into MongoDB"
pnpm exec tsx ops/spaces/ingest-catalog-to-mongo.ts

log "Step 4 — Model pipeline"
if [[ "${RUN_MODEL_ANALYSIS:-true}" == "true" ]]; then
  pnpm exec tsx ops/model-analysis/run-full-model-pipeline.ts || warn "Model pipeline degraded"
else
  warn "RUN_MODEL_ANALYSIS=false — skipping model analysis"
fi

log "Step 5 — Ping backend"
API_BASE="${API_BASE:-http://localhost:3000}"
if ! curl -sf "${API_BASE}/health" >/dev/null 2>&1; then
  warn "API not reachable at ${API_BASE} — start with: pnpm dev"
  warn "Skipping E2E queries (start server and re-run ops/tests/run-solux-e2e-queries.ts)"
  E2E_SKIPPED=1
else
  ok "API healthy at ${API_BASE}"
fi

QUERY_TESTS_PASSED=false
if [[ -z "${E2E_SKIPPED:-}" ]]; then
  log "Step 6 — E2E query tests"
  if API_BASE="${API_BASE}" pnpm exec tsx ops/tests/run-solux-e2e-queries.ts; then
    QUERY_TESTS_PASSED=true
  else
    warn "E2E query tests failed — see report above"
  fi
fi

log "Step 7 — Final readiness report"
RESOLVED="${DATA_ROOT}/manifests/resolved_data_paths.json"
CANDIDATE_COUNT=0
if [[ -f "${RESOLVED}" ]]; then
  CANDIDATE_COUNT=$(node -e "
    const fs=require('fs');
    const r=JSON.parse(fs.readFileSync('${RESOLVED}','utf8'));
    console.log(r.objectCounts?.['datasets/solux-site-screening/${DATASET_VERSION}']??0);
  ")
fi

MONGO_READY=false
MODEL_READY=false
if [[ -n "${MONGODB_URI:-}" ]]; then
  MONGO_READY=$(node -e "
    const {MongoClient}=require('mongodb');
    (async()=>{
      const c=new MongoClient(process.env.MONGODB_URI);
      await c.connect();
      const n=await c.db(process.env.MONGODB_DB||'solux').collection('candidate_site_summaries').countDocuments({});
      console.log(n>0?'true':'false');
      await c.close();
    })().catch(()=>console.log('false'));
  " 2>/dev/null || echo false)
fi

if [[ -f "${RESOLVED}" ]]; then
  SPACES_READY=true
else
  SPACES_READY=false
fi

REPORT="${DATA_ROOT}/manifests/final_readiness_report.json"
node -e "
const fs=require('fs');
const report={
  datasetVersion: process.env.DATASET_VERSION||'v0.1',
  datasetPrefix: process.env.SOLUX_DATASET_PREFIX,
  outputPrefix: process.env.SOLUX_OUTPUT_PREFIX,
  runPrefix: process.env.SOLUX_RUN_PREFIX,
  candidateCount: Number('${CANDIDATE_COUNT}'),
  mongoReady: '${MONGO_READY}'==='true',
  spacesReady: ${SPACES_READY},
  modelEndpointReady: null,
  modelOutputsReady: null,
  deterministicFallbackReady: true,
  learningLoopReady: '${MONGO_READY}'==='true',
  queryTestsPassed: ${QUERY_TESTS_PASSED:-false},
  warnings: [],
  nextActions: [],
  generatedAt: new Date().toISOString(),
};
if(!report.mongoReady) report.nextActions.push('Run ingest-catalog-to-mongo.ts');
if(!report.spacesReady) report.nextActions.push('Run discover-solux-paths.sh');
if(!report.queryTestsPassed) report.nextActions.push('Start pnpm dev and run E2E tests');
fs.mkdirSync('${DATA_ROOT}/manifests',{recursive:true});
fs.writeFileSync('${REPORT}', JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
"

ok "Readiness report → ${REPORT}"
