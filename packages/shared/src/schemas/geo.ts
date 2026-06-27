import { z } from 'zod'

export const PointSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number(), z.number()]), // [lon, lat]
})

export const PolygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
})

export const MultiPolygonSchema = z.object({
  type: z.literal('MultiPolygon'),
  coordinates: z.array(z.array(z.array(z.tuple([z.number(), z.number()])))),
})

export const GeometrySchema = z.discriminatedUnion('type', [
  PointSchema,
  PolygonSchema,
  MultiPolygonSchema,
])

export const BBoxSchema = z.tuple([
  z.number(), // minLon
  z.number(), // minLat
  z.number(), // maxLon
  z.number(), // maxLat
])

export type Point = z.infer<typeof PointSchema>
export type Polygon = z.infer<typeof PolygonSchema>
export type MultiPolygon = z.infer<typeof MultiPolygonSchema>
export type Geometry = z.infer<typeof GeometrySchema>
export type BBox = z.infer<typeof BBoxSchema>
