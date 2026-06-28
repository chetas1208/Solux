/** Curated screening projects — each locked to a real dataset region. */
export interface ShowcaseEntry {
  slug: string
  name: string
  subtitle: string
  regionLabel: string
  country: 'India' | 'USA'
  technology: string
  capacityLabel: string
  /** Forces candidate retrieval to this region set (matches parquet `region` codes). */
  regionFilter: string[]
  rawPrompt: string
  defaultQuery: string
  flyTo: { lon: number; lat: number; height: number }
}

export const SHOWCASE_CATALOG: ShowcaseEntry[] = [
  {
    slug: 'india-rajasthan-solar-storage',
    name: 'Rajasthan Solar+Storage',
    subtitle: '100 MW PV + 50 MW battery · Thar Desert grid corridor',
    regionLabel: 'Rajasthan (RAJ)',
    country: 'India',
    technology: 'Solar + storage',
    capacityLabel: '100 MW / 50 MW',
    regionFilter: ['RAJ'],
    rawPrompt:
      'Find the best sites for a 100 MW solar plus 50 MW battery project in Rajasthan. Avoid dense vegetation, protected land, steep slopes, and areas far from roads or transmission.',
    defaultQuery:
      'Rank the top land-based sites for 100 MW solar plus 50 MW storage in Rajasthan with strong irradiance and grid proximity.',
    flyTo: { lon: 73.5, lat: 26.5, height: 2_400_000 },
  },
  {
    slug: 'india-gujarat-utility',
    name: 'Gujarat Utility Solar',
    subtitle: '75 MW land PV · coastal grid access',
    regionLabel: 'Gujarat (GUJ)',
    country: 'India',
    technology: 'Solar PV',
    capacityLabel: '75 MW',
    regionFilter: ['GUJ'],
    rawPrompt:
      'Screen Gujarat for 75 MW land-based utility solar. Avoid dense vegetation and steep slopes. Prioritize high GHI, buildability, and substation proximity within 25 km.',
    defaultQuery:
      'Rank Gujarat land solar sites for 75 MW with the best solar output and grid connectivity evidence.',
    flyTo: { lon: 72.5, lat: 22.5, height: 1_800_000 },
  },
  {
    slug: 'usa-texas-utility',
    name: 'Texas Utility Solar',
    subtitle: '150 MW · West Texas irradiance belt',
    regionLabel: 'Texas (TX)',
    country: 'USA',
    technology: 'Utility-scale PV',
    capacityLabel: '150 MW',
    regionFilter: ['TX'],
    rawPrompt:
      'Screen Texas for utility-scale solar sites around 150 MW. Prioritize high PV output, low slope, grid proximity, and lower heat/dust power-loss risk.',
    defaultQuery:
      'Show the highest-confidence utility solar sites in Texas above 120 MW with strong PV output and grid proximity.',
    flyTo: { lon: -101, lat: 31.5, height: 3_200_000 },
  },
  {
    slug: 'usa-arizona-utility',
    name: 'Arizona Utility Solar',
    subtitle: '100 MW · Sonoran Desert · low vegetation',
    regionLabel: 'Arizona (AZ)',
    country: 'USA',
    technology: 'Utility-scale PV',
    capacityLabel: '100 MW',
    regionFilter: ['AZ'],
    rawPrompt:
      'Identify utility-scale solar sites in Arizona for 100 MW. Avoid protected desert areas. Require road access within 5 km and prefer low vegetation conflict.',
    defaultQuery:
      'Find the best 100 MW Arizona desert solar sites with road access, low slope, and strong irradiance.',
    flyTo: { lon: -112, lat: 34, height: 2_000_000 },
  },
  {
    slug: 'usa-nevada-desert',
    name: 'Nevada Desert Utility',
    subtitle: '200 MW · low dust · road access',
    regionLabel: 'Nevada (NV)',
    country: 'USA',
    technology: 'Utility-scale PV',
    capacityLabel: '200 MW',
    regionFilter: ['NV'],
    rawPrompt:
      'Identify utility-scale solar sites in Nevada for 200 MW. Avoid protected desert areas. Require road access within 5 km and prefer low atmosphere and dust power-loss risk.',
    defaultQuery:
      'Find the best 200 MW Nevada desert solar sites with road access, low slope, and strong irradiance.',
    flyTo: { lon: -116.5, lat: 39, height: 1_400_000 },
  },
]

export function catalogBySlug(slug: string): ShowcaseEntry | undefined {
  return SHOWCASE_CATALOG.find((e) => e.slug === slug)
}

export function normalizePromptKey(prompt: string): string {
  return prompt.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120)
}

/** Legacy slugs from prior catalog — hide from UI, do not recreate. */
export const DEPRECATED_SHOWCASE_SLUGS = [
  'india-raj-guj-solar-storage',
  'usa-southwest-utility',
  'india-gujarat-floating',
  'india-karnataka-land',
]
