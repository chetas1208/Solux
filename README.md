# Solux — AI Fatal-Flaw Screening for Solar Site Selection

Solux is an AI agent that screens solar and solar-plus-storage development sites across land, reservoirs, canals, lakes, and shallow coastal water. It returns **GO / INVESTIGATE / KILL** decisions grounded in real geospatial and energy data.

## What it does

1. Developer enters a natural-language project requirement
2. Gemini parses it into a typed `ProjectSpec`
3. Developer confirms structured constraints
4. Backend retrieves real data (NREL NSRDB, PVGIS, OSM, GEBCO, land-cover rasters)
5. Candidate sites are generated and scored across 8 dimensions
6. Gemini writes a structured report **only from tool outputs** — no invented claims
7. MiniMax optionally generates a 60-second spoken executive briefing
8. UI shows map, ranked sites, score breakdown, evidence trace, and decision

## Stack

| Layer | Choice |
|-------|--------|
| Frontend | Nuxt 4, Vue 3, TypeScript, Tailwind, MapLibre GL JS |
| Backend | Hono on Node 22, Zod, TypeScript |
| Database | MongoDB Atlas (GeoJSON + 2dsphere indexes) |
| AI planner | Gemini 2.0 Flash (structured tool calls) |
| AI auditor | MiniMax (spoken briefing, optional) |
| Infra | DigitalOcean App Platform + Spaces |

## Monorepo layout

```
apps/
  web/       Nuxt 4 frontend
  api/       Hono backend
  worker/    Background job runner
packages/
  shared/    Zod schemas + TypeScript types
  geo-utils/ Turf.js-based geospatial helpers
  config/    Typed env config
ops/
  docker/
  digitalocean/
  scripts/   DB index setup, seed
```

## Setup

### Prerequisites

- Node 22+
- pnpm 9+
- MongoDB Atlas cluster (free tier works)
- Gemini API key (https://aistudio.google.com)
- Optional: NREL API key, PVGIS (free), MapTiler key

### Install

```bash
cp .env.example .env
# Fill in required vars: MONGODB_URI, MONGODB_DB, GEMINI_API_KEY

pnpm install
pnpm db:indexes   # creates MongoDB indexes

pnpm dev          # single process on :3000 — UI + API (/health, /v1/*)
```

### Data sources

Solux **never fakes data**. Missing data sources show a clear status warning and lower confidence. Real configured sources:

| Source | Var needed | What it provides |
|--------|-----------|-----------------|
| NREL NSRDB | `NREL_API_KEY` | US solar irradiance (GHI, DNI, temperature) |
| PVGIS | none (free) | EU/global solar resource via REST API |
| OpenStreetMap | none | Grid lines, roads, land use, waterways |
| Global Solar Atlas | `GLOBAL_SOLAR_ATLAS_DATA_DIR` | Global GHI raster |
| USPVDB | `USPVDB_DATA_DIR` | US utility-scale PV database |
| GEBCO | `GEBCO_DATA_DIR` | Ocean/lake bathymetry |
| Copernicus Marine | `COPERNICUS_MARINE_CONFIG` | Wave height, current speed |

### Run tests

```bash
pnpm test
# Integration tests auto-skip when API keys / data are absent
```

## Scoring dimensions

| Dimension | Weight | KILL trigger |
|-----------|--------|-------------|
| Solar output | 25% | GHI < 3.5 kWh/m²/day |
| Vegetation tradeoff | 15% | Protected forest / high-biodiversity overlap |
| Grid connectivity | 20% | No 33kV+ line within 25 km |
| Buildability | 15% | Slope > 15° or protected area overlap |
| Storage feasibility | 10% | — |
| Power loss / atmosphere | 5% | High aerosol optical depth region |
| Environmental / water | 10% | Depth > 3m or wave Hs > 0.5m for water sites |

**GO** = strong output + buildability + connectivity, high evidence confidence  
**INVESTIGATE** = promising but one or more uncertain/missing data layers  
**KILL** = any hard constraint violated or evidence confidence < 40%

## Sponsors

- **Google** — Gemini 2.0 Flash as agent planner and report writer
- **MiniMax** — spoken executive briefing
- **DigitalOcean** — App Platform hosting, Spaces for report artifacts
- **Modular / Mojo** — score-kernel interface placeholder for future acceleration
- **MongoDB** — Atlas for GeoJSON storage and 2dsphere spatial queries

## Deployment

See `ops/digitalocean/DEPLOY.md`.
