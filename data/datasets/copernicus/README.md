# Copernicus Marine — manual setup required

Copernicus Marine data requires a free account at https://marine.copernicus.eu/

After signup:

```bash
pip install copernicusmarine
copernicusmarine login
copernicusmarine subset \
  --dataset-id <wave-or-current-product-id> \
  --variable VHM0 \
  --output-directory ./data/copernicus/
```

Then set `COPERNICUS_MARINE_CONFIG` to this directory in `.env` and DO App Spec.

No public anonymous bulk download is available for this source.
