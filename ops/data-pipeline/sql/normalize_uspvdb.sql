-- Normalize USPVDB (U.S. Large-Scale Solar PV Database) to canonical schema.
-- Input table: uspvdb (created by ogr2ogr + DuckDB ST_Read)
-- Output table: uspvdb_normalized
--
-- Source: Lawrence Berkeley National Laboratory
-- License: Public domain / open government data
-- Citation: Fujita KS et al. (2023) DOE/GO-102023-6129

CREATE TABLE uspvdb_normalized AS
SELECT
  -- Identifier
  COALESCE("case_id", "eia_id", "OBJECTID"::TEXT) AS site_id,

  -- Name
  COALESCE("p_name", "name", "plant_name") AS plant_name,

  -- Capacity (MW)
  CASE
    WHEN TRY_CAST(COALESCE("p_cap_ac", "p_cap_dc") AS DOUBLE) IS NOT NULL
      THEN TRY_CAST(COALESCE("p_cap_ac", "p_cap_dc") AS DOUBLE)
    ELSE NULL
  END AS capacity_mw_ac,
  TRY_CAST("p_cap_dc" AS DOUBLE) AS capacity_mw_dc,

  -- Geometry centroid
  TRY_CAST("ylat" AS DOUBLE) AS centroid_lat,
  TRY_CAST("xlong" AS DOUBLE) AS centroid_lon,

  -- State / county
  "state" AS state_code,
  "county" AS county_name,

  -- Technology
  COALESCE("p_tech_sec", "tech") AS technology,
  COALESCE("p_type", "type") AS project_type,

  -- Year online
  TRY_CAST(COALESCE("p_year", "online_year") AS INTEGER) AS year_online,

  -- Status
  COALESCE("p_status", "status") AS status,

  -- Land use
  "p_own_name" AS owner_name,
  "p_own_type" AS owner_type,

  -- Source metadata
  'uspvdb' AS source_id,
  'Lawrence Berkeley National Laboratory' AS source_org,
  'https://uspvdb.lbl.gov' AS source_url,
  'Public domain' AS source_license,
  NOW() AS normalized_at,

  -- Geometry (passthrough)
  geom AS geometry

FROM uspvdb
WHERE
  -- Exclude rows with no capacity or no geometry
  COALESCE(
    TRY_CAST("p_cap_ac" AS DOUBLE),
    TRY_CAST("p_cap_dc" AS DOUBLE)
  ) IS NOT NULL
  AND geom IS NOT NULL;
