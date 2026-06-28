#!/usr/bin/env bash
# Package processed outputs, generate manifests and PMTiles.
# Output: manifests/, tiles/, processed/solux_data_catalog.json
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

PROC="${DATA_ROOT}/processed"
TILES="${DATA_ROOT}/tiles"
MANIFESTS="${DATA_ROOT}/manifests"
mkdir -p "$TILES" "$MANIFESTS"

log_info "Packaging dataset …"

# ── Generate MBTiles / PMTiles ─────────────────────────────────────────────────
if command -v tippecanoe &>/dev/null; then
  log_info "Generating PMTiles …"

  # Candidate sites tile
  if [[ -f "${PROC}/candidates/solux_candidate_sites.geojson" ]]; then
    log_info "  Building solux_candidates.mbtiles …"
    tippecanoe \
      -o "${TILES}/solux_candidates.mbtiles" \
      -Z 4 -z 12 \
      --drop-densest-as-needed \
      --extend-zooms-if-still-dropping \
      --layer=candidates \
      --name="Solux Candidate Sites" \
      --description="Solux v0.1 solar candidate cells" \
      --force \
      "${PROC}/candidates/solux_candidate_sites.geojson" 2>/dev/null \
      && log_ok "solux_candidates.mbtiles" \
      || log_warn "tippecanoe failed for candidates"
  fi

  # Scored sites tile
  if [[ -f "${PROC}/scoring/solux_site_scores.geojson" ]]; then
    log_info "  Building solux_scores.mbtiles …"
    tippecanoe \
      -o "${TILES}/solux_scores.mbtiles" \
      -Z 4 -z 12 \
      --drop-densest-as-needed \
      --layer=scores \
      --name="Solux Site Scores" \
      --force \
      "${PROC}/scoring/solux_site_scores.geojson" 2>/dev/null \
      && log_ok "solux_scores.mbtiles"
  fi

  # Grid tile
  for f in "${PROC}/grid/"*.geojson; do
    [[ -f "$f" ]] || continue
    fname=$(basename "${f%.geojson}")
    tippecanoe \
      -o "${TILES}/${fname}.mbtiles" \
      -Z 4 -z 12 \
      --coalesce-densest-as-needed \
      --layer=grid \
      --force \
      "$f" 2>/dev/null \
      && log_ok "${fname}.mbtiles"
  done

  # Convert MBTiles → PMTiles if pmtiles CLI available
  if command -v pmtiles &>/dev/null; then
    for mb in "${TILES}"/*.mbtiles; do
      [[ -f "$mb" ]] || continue
      pm="${mb%.mbtiles}.pmtiles"
      pmtiles convert "$mb" "$pm" 2>/dev/null \
        && log_ok "$(basename "$pm")" \
        || log_warn "PMTiles conversion failed for $(basename "$mb")"
    done
  else
    log_warn "pmtiles CLI not found — MBTiles only. Install: npm install -g pmtiles"
  fi
else
  log_warn "tippecanoe not found — skipping tile generation"
  log_warn "Install: https://github.com/mapbox/tippecanoe"
fi

# ── Source Manifest ────────────────────────────────────────────────────────────
log_info "Generating source manifest …"
run_tsx "manifest.ts" write-source-manifest \
  --data-root "$DATA_ROOT" \
  --pipeline-dir "$PIPELINE_DIR" \
  --output "${MANIFESTS}/source_manifest.json" 2>/dev/null \
  || {
    # Fallback: combine source-status.jsonl if tsx unavailable
    if [[ -f "${MANIFESTS}/source-status.jsonl" ]]; then
      jq -s '.' "${MANIFESTS}/source-status.jsonl" > "${MANIFESTS}/source_manifest.json"
      log_ok "source_manifest.json (from status JSONL)"
    fi
  }

# ── Dataset Manifest ───────────────────────────────────────────────────────────
log_info "Generating dataset manifest …"
run_tsx "manifest.ts" write-dataset-manifest \
  --data-root "$DATA_ROOT" \
  --pipeline-dir "$PIPELINE_DIR" \
  --output "${MANIFESTS}/dataset_manifest.json" 2>/dev/null \
  || {
    # Minimal fallback
    cat > "${MANIFESTS}/dataset_manifest.json" << JSON
{
  "name": "Solux Site Screening Dataset",
  "version": "0.1.0",
  "generatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "dataRoot": "${DATA_ROOT}",
  "countries": ["${COUNTRY_SCOPE//,/\",\"}"],
  "files": {
    "candidates": "${PROC}/candidates/solux_candidate_sites.parquet",
    "scores": "${PROC}/scoring/solux_site_scores.parquet",
    "catalog": "${PROC}/solux_data_catalog.json"
  }
}
JSON
    log_ok "dataset_manifest.json (minimal)"
  }

# ── License Report ─────────────────────────────────────────────────────────────
cp "${PIPELINE_DIR}/LICENSE_NOTES.md" "${MANIFESTS}/license_report.md" 2>/dev/null || true

# ── Data Catalog (for backend) ─────────────────────────────────────────────────
log_info "Generating solux_data_catalog.json …"
run_tsx "sourceStatus.ts" write-catalog \
  --data-root "$DATA_ROOT" \
  --pipeline-dir "$PIPELINE_DIR" \
  --output "${PROC}/solux_data_catalog.json" \
  --do-spaces-endpoint "${DIGITALOCEAN_SPACES_ENDPOINT:-}" \
  --do-spaces-bucket "${DIGITALOCEAN_SPACES_BUCKET:-}" 2>/dev/null \
  || {
    # Minimal fallback catalog
    CAND_COUNT=$(duckdb -c "SELECT COUNT(*) FROM read_parquet('${PROC}/candidates/solux_candidate_sites.parquet');" 2>/dev/null | tail -1 | tr -d ' ' || echo "0")
    cat > "${PROC}/solux_data_catalog.json" << JSON
{
  "datasetVersion": "0.1.0",
  "generatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "countries": ["${COUNTRY_SCOPE//,/\",\"}"],
  "candidateCount": ${CAND_COUNT},
  "note": "Full catalog requires tsx. Run: tsx src/sourceStatus.ts write-catalog"
}
JSON
    log_ok "solux_data_catalog.json (minimal)"
  }

# ── Disk usage summary ─────────────────────────────────────────────────────────
echo ""
log_info "Disk usage:"
du -sh "${DATA_ROOT}/raw" "${DATA_ROOT}/processed" "${DATA_ROOT}/tiles" \
  "${DATA_ROOT}/manifests" 2>/dev/null | while read -r size path; do
  log_info "  $size  $path"
done

log_ok "Dataset packaging complete."
log_info "Manifests: ${MANIFESTS}/"
log_info "Tiles: ${TILES}/"
log_info "Catalog: ${PROC}/solux_data_catalog.json"
