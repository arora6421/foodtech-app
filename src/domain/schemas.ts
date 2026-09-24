import { z } from 'zod'
import {
  ALLERGENS,
  AXES,
  CUISINES,
  FLAVOURS,
  FORMATS,
  LEVELS,
  MEAL_TYPES,
  MOOD_TAGS,
  PROTEINS,
  TEMPERATURES,
  TEXTURES,
} from './taxonomy'
import type { Cuisine } from './taxonomy'
import { dietaryIssues } from './diet'

// Zod schemas are the single source of truth for catalogue entities (MVP_SPEC §5).
// They validate the mock catalogue today and API responses later.

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'ids are kebab-case slugs')

export const LevelSchema = z.literal(LEVELS)
export const GeoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

export const DietaryFactsSchema = z.object({
  vegetarian: z.boolean(),
  vegan: z.boolean(),
  pescatarianSafe: z.boolean(),
  containsPork: z.boolean(),
  glutenFree: z.boolean(),
})

export const ImageRefSchema = z.object({
  kind: z.enum(['generated', 'licensed', 'venue']),
  src: z.string().min(1),
  alt: z.string().min(1, 'alt text is required (MVP_SPEC §22)'),
  credit: z.string().optional(),
  dominantColour: z.string().regex(/^#[0-9a-f]{6}$/i),
})

export const HandoffTargetSchema = z.object({
  kind: z.enum(['delivery_platform', 'maps']),
  label: z.string().min(1),
  url: z.string().url().optional(),
})

const AxesSchema = z.object(Object.fromEntries(AXES.map((a) => [a, LevelSchema])) as Record<
  (typeof AXES)[number],
  typeof LevelSchema
>)

export const DishArchetypeSchema = z
  .object({
    id: slug,
    name: z.string().min(1),
    cuisine: z.enum(CUISINES as [Cuisine, ...Cuisine[]]),
    format: z.enum(FORMATS),
    proteins: z.array(z.enum(PROTEINS)),
    flavours: z.array(z.enum(FLAVOURS)).min(1).max(3),
    textures: z.array(z.enum(TEXTURES)).min(1).max(3),
    moods: z.array(z.enum(MOOD_TAGS)),
    mealType: z.enum(MEAL_TYPES),
    temperature: z.enum(TEMPERATURES),
    axes: AxesSchema,
    keyIngredients: z.array(z.string().min(1)).min(1),
    dietary: DietaryFactsSchema,
    declaredAllergens: z.array(z.enum(ALLERGENS)).optional(),
    image: ImageRefSchema,
  })
  .superRefine((a, ctx) => {
    for (const issue of dietaryIssues(a.dietary, a.proteins)) ctx.addIssue({ code: 'custom', message: issue })
    for (const field of ['proteins', 'flavours', 'textures', 'moods'] as const) {
      if (new Set(a[field]).size !== a[field].length) ctx.addIssue({ code: 'custom', message: `duplicate ${field}` })
    }
  })

export const VenueSchema = z.object({
  id: slug,
  name: z.string().min(1),
  cuisine: z.enum(CUISINES as [Cuisine, ...Cuisine[]]),
  location: GeoPointSchema,
  addressLine: z.string().min(1),
  offersDelivery: z.boolean(),
  dineIn: z.boolean(),
  handoff: z.array(HandoffTargetSchema),
})

export const OfferingOverridesSchema = z.object({
  axes: AxesSchema.partial().optional(),
  dietary: DietaryFactsSchema.partial().optional(),
  declaredAllergens: z.array(z.enum(ALLERGENS)).optional(),
})

export const OfferingSchema = z.object({
  id: slug,
  venueId: slug,
  archetypeId: slug,
  name: z.string().min(1),
  description: z.string().min(1).max(140),
  pricePence: z.number().int().min(300).max(4000),
  image: ImageRefSchema.optional(),
  overrides: OfferingOverridesSchema.optional(),
})

export const CatalogueSchema = z.object({
  version: z.string().min(1),
  archetypes: z.array(DishArchetypeSchema),
  venues: z.array(VenueSchema),
  offerings: z.array(OfferingSchema),
})
