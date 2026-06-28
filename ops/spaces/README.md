# Solux DigitalOcean Spaces Ops

Safe prefix-scoped sync for the Solux data lake. **Never deletes bucket root.**

## Prefix layout

| Prefix | Purpose |
|--------|---------|
| `datasets/solux-site-screening/v0.1/` | Curated dataset (processed, tiles, manifests) |
| `outputs/solux-site-screening/v0.1/` | Model analysis outputs |
| `runs/solux-site-screening/v0.1/` | Query/run logs |
| `archive/solux-site-screening/` | Previous versions (never auto-deleted) |

## Scripts

```bash
# 1. Safe cleanup (dry-run + confirmation)
CLEAN_CONFIRM=DELETE_SOLUX_PREFIXES bash ops/spaces/clean-solux-prefixes.sh

# 2. Upload validated dataset
DO_UPLOAD=true bash ops/spaces/upload-solux-data.sh

# 3. Verify remote objects
bash ops/spaces/verify-spaces-upload.sh

# 4. Download for model worker
bash ops/spaces/download-solux-data.sh
```

## Safety

- Requires `CLEAN_CONFIRM=DELETE_SOLUX_PREFIXES`
- Refuses empty, `/`, `.`, or `*` prefixes
- Never runs `aws s3 rb` or bucket delete
- Raw data only deleted when `CLEAN_RAW=true` **and** `PURGE_CONFIRM=DELETE_SOLUX_RAW`
