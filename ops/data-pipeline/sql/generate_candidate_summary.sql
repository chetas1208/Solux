-- Generate candidate site summary GeoJSON via DuckDB.
-- Joins candidate cells with score results for the catalog.
-- Run: duckdb < sql/generate_candidate_summary.sql
--
-- Environment: DATA_ROOT is substituted by the shell script.

INSTALL json; LOAD json;
INSTALL spatial; LOAD spatial;

-- Candidate + score join
CREATE OR REPLACE VIEW candidate_summary AS
SELECT
  c.h3Index,
  c.h3Res,
  c.country,
  c.region,
  c.centroid_lat,
  c.centroid_lon,
  c.area_km2,
  c.site_surface_type,
  s.final_score,
  s.decision,
  s.confidence_score,
  s.solar_score,
  s.grid_score,
  s.buildability_score,
  s.pvgis_ghi,
  s.data_sources_used,
  s.missing_data_flags,
  c.generated_at
FROM read_parquet('${DATA_ROOT}/processed/candidates/solux_candidate_sites.parquet') c
LEFT JOIN read_parquet('${DATA_ROOT}/processed/scoring/solux_site_scores.parquet') s
  ON c.h3Index = s.h3Index;

-- Summary statistics
SELECT
  country,
  site_surface_type,
  decision,
  COUNT(*) AS count,
  ROUND(AVG(final_score), 1) AS avg_score,
  ROUND(AVG(confidence_score), 1) AS avg_confidence,
  ROUND(AVG(pvgis_ghi), 2) AS avg_ghi
FROM candidate_summary
WHERE final_score IS NOT NULL
GROUP BY country, site_surface_type, decision
ORDER BY country, avg_score DESC;
