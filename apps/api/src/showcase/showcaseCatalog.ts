/** Curated screening projects — one per region/use-case, no duplicates in UI. */
export interface ShowcaseEntry {
  slug: string
  name: string
  subtitle: string
  regionLabel: string
  country: 'India' | 'USA'
  technology: string
  capacityLabel: string
  rawPrompt: string
  defaultQuery: string
  flyTo: { lon: number; lat: number; height: number }
}

export const SHOWCASE_CATALOG: ShowcaseEntry[] = [
  {
    slug: 'india-raj-guj-solar-storage',
    name: 'Rajasthan · Gujarat Solar+Storage',
    subtitle: '100 MW PV + 50 MW battery · land & water-adjacent',
    regionLabel: 'Rajasthan, Gujarat',
    country: 'India',
    technology: 'Solar + storage',
    capacityLabel: '100 MW / 50 MW',
    rawPrompt:
      'Find the best sites for a 100 MW solar plus 50 MW battery project in Rajasthan and Gujarat. Avoid dense vegetation, protected land, steep slopes, and areas far from roads or transmission. Include reservoir or canal-adjacent floating solar options only if water evidence exists.',
    defaultQuery:
      'Rank the top land and reservoir-adjacent sites for 100 MW solar plus 50 MW storage in Rajasthan and Gujarat. Prioritize grid proximity and low vegetation conflict.',
    flyTo: { lon: 74, lat: 26, height: 2_600_000 },
  },
  {
    slug: 'usa-southwest-utility',
    name: 'US Southwest Utility Solar',
    subtitle: 'AZ · NV · CA · NM · TX · ≥80 MW',
    regionLabel: 'Arizona, Nevada, California, New Mexico, Texas',
    country: 'USA',
    technology: 'Utility-scale PV',
    capacityLabel: '≥80 MW',
    rawPrompt:
      'Screen Arizona, Nevada, California, New Mexico, and Texas for utility-scale solar sites above 80 MW. Prioritize high PV output, low slope, grid proximity, low vegetation conflict, and lower heat/dust power-loss risk. Do not claim grid capacity unless evidence exists.',
    defaultQuery:
      'Show the highest-confidence utility solar sites above 80 MW across Arizona, Nevada, California, New Mexico, and Texas with strong PV output and grid proximity.',
    flyTo: { lon: -108, lat: 34, height: 3_800_000 },
  },
  {
    slug: 'india-gujarat-floating',
    name: 'Gujarat Floating PV',
    subtitle: '50 MW reservoir sites · depth ≤2.5 m',
    regionLabel: 'Gujarat',
    country: 'India',
    technology: 'Floating PV',
    capacityLabel: '50 MW',
    rawPrompt:
      'Find 50 MW floating solar candidates in Gujarat reservoirs and canals. Maximum 2.5 m water depth. Must be within 15 km of 66 kV or higher transmission. Only recommend sites where water-body evidence exists.',
    defaultQuery:
      'Rank Gujarat floating solar reservoir and canal sites for 50 MW with verified water evidence and transmission proximity.',
    flyTo: { lon: 72.5, lat: 22.5, height: 1_800_000 },
  },
  {
    slug: 'usa-nevada-desert',
    name: 'Nevada Desert Utility',
    subtitle: '200 MW · low dust · road access',
    regionLabel: 'Nevada',
    country: 'USA',
    technology: 'Utility-scale PV',
    capacityLabel: '200 MW',
    rawPrompt:
      'Identify utility-scale solar sites in Nevada for 200 MW. Avoid protected desert areas. Require road access within 5 km and prefer low atmosphere and dust power-loss risk. No storage required.',
    defaultQuery:
      'Find the best 200 MW Nevada desert solar sites with road access, low slope, and strong irradiance.',
    flyTo: { lon: -116.5, lat: 39, height: 1_400_000 },
  },
  {
    slug: 'india-karnataka-land',
    name: 'Karnataka Land Solar',
    subtitle: '75 MW · low vegetation · grid-ready',
    regionLabel: 'Karnataka',
    country: 'India',
    technology: 'Solar PV',
    capacityLabel: '75 MW',
    rawPrompt:
      'Screen Karnataka for 75 MW land-based solar sites. Avoid dense vegetation and steep slopes. Prioritize high GHI, buildability, and substation proximity within 25 km.',
    defaultQuery:
      'Rank Karnataka land solar sites for 75 MW with the best solar output and grid connectivity evidence.',
    flyTo: { lon: 76.5, lat: 15, height: 2_200_000 },
  },
]

export function catalogBySlug(slug: string): ShowcaseEntry | undefined {
  return SHOWCASE_CATALOG.find((e) => e.slug === slug)
}

export function normalizePromptKey(prompt: string): string {
  return prompt.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120)
}
