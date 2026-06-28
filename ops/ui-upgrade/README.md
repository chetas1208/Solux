# UI Upgrade — Command Center

## Information architecture

| Route | Role |
|-------|------|
| `/projects/[id]` | Full-screen 3D Earth command center |
| `/projects/[id]/sites/[siteId]` | Deep fatal-flaw report only |
| `/status` | System readiness |
| `/diagnostics/maps` | Map provider health |

## Layout (`/projects/[id]`)

- **Top bar:** dataset source, scoring policy, run state, confidence, model status, map readiness
- **Left rail:** constraints, run controls, layer toggles, decision summary
- **Center:** Cesium 3D Earth (MapLibre/table fallback)
- **Right rail:** ranked GO/INVESTIGATE/KILL cards
- **Bottom drawer:** Evidence | Data Sources | Model Analysis | Learning Loop | Diagnostics

Removed from main workspace: duplicate compare scatter, redundant header panels, separate evidence/compare links as primary navigation.
